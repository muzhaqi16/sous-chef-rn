/**
 * Under `errorPolicy: 'all'` a failed mutation or query RESOLVES with its
 * `error`, and a local write resolves with its `status`: neither throws. A
 * `try` / `.catch` around one catches only what never happens, so the result
 * itself has to be read.
 */

/** Hooks whose first tuple element sends an operation and resolves its result. */
const TUPLE_HOOKS = new Set(['useMutation', 'useLazyQuery']);
/** Hooks returning an object whose `send` resolves a settled write. */
const SEND_HOOKS = new Set(['useLocalWrite']);
/** Functions that resolve a settled write. */
const SENDING_FUNCTIONS = new Set(['sendLocalWrite']);
/** Fields that tell a resolved failure apart. */
const FAILURE_FIELDS = new Set(['error', 'errors', 'status']);

const calleeName = call =>
  call.callee.type === 'Identifier' ? call.callee.name : undefined;

/** The call a node is, under any `await`, `void` or parentheses. */
const unwrap = node => {
  let current = node;
  while (
    current &&
    (current.type === 'AwaitExpression' ||
      current.type === 'UnaryExpression' ||
      current.type === 'ChainExpression')
  )
    current = current.argument ?? current.expression;
  return current;
};

/** The innermost function enclosing `node`, or the program. */
const scopeOf = node => {
  let current = node.parent;
  while (
    current &&
    current.type !== 'FunctionDeclaration' &&
    current.type !== 'FunctionExpression' &&
    current.type !== 'ArrowFunctionExpression' &&
    current.type !== 'Program'
  )
    current = current.parent;
  return current;
};

/** Whether `node` sits in a `try` block that has a `catch`, inside `scope`. */
const insideTryWithCatch = (node, scope) => {
  let current = node;
  while (current && current !== scope) {
    const parent = current.parent;
    if (parent?.type === 'TryStatement' && parent.block === current)
      return !!parent.handler;
    current = parent;
  }
  return false;
};

/** `call(...).catch(...)`, directly or after `.then(...)`/`.finally(...)`. */
const chainedCatch = call => {
  let current = call;
  while (
    current.parent?.type === 'MemberExpression' &&
    current.parent.object === current &&
    current.parent.parent?.type === 'CallExpression'
  ) {
    const method = current.parent.property.name;
    if (method === 'catch') return current.parent.parent;
    current = current.parent.parent;
  }
  return undefined;
};

/** Every reference to `name` inside `scope` but the declaration itself. */
const referencesIn = (scope, name, declaration) => {
  const found = [];
  const visit = node => {
    if (!node || typeof node.type !== 'string') return;
    if (
      node !== declaration &&
      node.type === 'Identifier' &&
      node.name === name
    )
      found.push(node);
    for (const key of Object.keys(node)) {
      if (key === 'parent') continue;
      // `x.result` and `{ result: … }` name a property, not the binding.
      if (
        key === 'property' &&
        node.type === 'MemberExpression' &&
        !node.computed
      )
        continue;
      if (key === 'key' && node.type === 'Property' && !node.computed) continue;
      const child = node[key];
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child.type === 'string') visit(child);
    }
  };
  visit(scope.body ?? scope);
  return found;
};

/**
 * Whether a reference reads the failure, or hands the result on to code that
 * may: `result.error`, `result.status`, `settle(result)`, `return result`.
 */
const readsFailure = reference => {
  const parent = reference.parent;
  if (parent.type === 'MemberExpression' && parent.object === reference) {
    return (
      parent.property.type === 'Identifier' &&
      FAILURE_FIELDS.has(parent.property.name)
    );
  }
  // A pattern names a new binding; it reads nothing.
  if (parent.type === 'Property' && parent.parent.type === 'ObjectPattern')
    return false;
  return true;
};

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A send caught with `try` / `.catch` reads the failure its result resolves with.',
      url: 'docs/rules/resolved-failure-is-read.md',
    },
    schema: [],
    messages: {
      failureUnread:
        "`{{name}}` resolves its failure — `error` from Apollo under `errorPolicy: 'all'`, `status` from a local write — rather than throwing, so this `{{guard}}` never sees it. Read the result: `settleMutation`, `result.error` or `settled.status`.",
    },
  },
  create(context) {
    /** Names that send: `[send] = useMutation(…)`, `client`, `write`. */
    const senders = new Set();
    const sendObjects = new Set();
    const clients = new Set();
    const calls = [];

    const isSendingCall = call => {
      if (call?.type !== 'CallExpression') return undefined;
      const name = calleeName(call);
      if (name && (senders.has(name) || SENDING_FUNCTIONS.has(name)))
        return name;
      const callee = call.callee;
      if (
        callee.type === 'MemberExpression' &&
        callee.object.type === 'Identifier' &&
        callee.property.type === 'Identifier'
      ) {
        const object = callee.object.name;
        const method = callee.property.name;
        if (method === 'send' && sendObjects.has(object))
          return `${object}.send`;
        if (
          (method === 'mutate' || method === 'query') &&
          (clients.has(object) || /client$/i.test(object))
        )
          return `${object}.${method}`;
      }
      return undefined;
    };

    const check = (call, name) => {
      // `errorPolicy: 'none'` makes a failure reject, so a catch does see it.
      const [options] = call.arguments;
      const policy =
        options?.type === 'ObjectExpression' &&
        options.properties.find(
          property =>
            property.type === 'Property' &&
            property.key.type === 'Identifier' &&
            property.key.name === 'errorPolicy',
        );
      if (policy?.value?.type === 'Literal' && policy.value.value === 'none')
        return;
      const scope = scopeOf(call);
      const caught = chainedCatch(call);
      const tried = insideTryWithCatch(call, scope);
      if (!caught && !tried) return;
      const guard = caught ? '.catch' : 'try / catch';
      const report = () =>
        context.report({
          node: call,
          messageId: 'failureUnread',
          data: { name, guard },
        });

      // `call().then(result => …)`: the callback's parameter is the result.
      if (
        call.parent.type === 'MemberExpression' &&
        call.parent.property.name === 'then'
      ) {
        const [callback] = call.parent.parent.arguments;
        // A named handler takes the result on to code this file cannot see.
        if (
          callback?.type !== 'ArrowFunctionExpression' &&
          callback?.type !== 'FunctionExpression'
        )
          return;
        const [param] = callback.params;
        if (!param) return report();
        if (param.type === 'Identifier') {
          const uses = referencesIn(callback, param.name, param);
          if (!uses.some(readsFailure)) report();
        } else if (param.type === 'ObjectPattern') {
          if (!readsFromPattern(param)) report();
        }
        return;
      }
      // Where the result lands: the value of the whole `.catch` chain, which a
      // handler may fold into the same `{ error }` shape, or the call's own.
      let holder = (caught ?? call).parent;
      while (
        holder.type === 'AwaitExpression' ||
        holder.type === 'ChainExpression'
      )
        holder = holder.parent;

      if (holder.type === 'VariableDeclarator') {
        if (holder.id.type === 'ObjectPattern') {
          if (!readsFromPattern(holder.id)) report();
          return;
        }
        if (holder.id.type === 'Identifier') {
          const uses = referencesIn(scope, holder.id.name, holder.id);
          if (!uses.some(readsFailure)) report();
        }
        return;
      }
      // Discarded: `await send(…);` or `void send(…)`.
      if (
        holder.type === 'ExpressionStatement' ||
        (holder.type === 'UnaryExpression' && holder.operator === 'void')
      )
        report();
    };

    const readsFromPattern = pattern =>
      pattern.properties.some(
        property =>
          property.type === 'RestElement' ||
          (property.key?.type === 'Identifier' &&
            FAILURE_FIELDS.has(property.key.name)),
      );

    return {
      VariableDeclarator(node) {
        const init = unwrap(node.init);
        if (init?.type !== 'CallExpression') return;
        const hook = calleeName(init);
        if (!hook) return;
        if (TUPLE_HOOKS.has(hook) && node.id.type === 'ArrayPattern') {
          const [first, state] = node.id.elements;
          // The hook's own state reads the failure, so a send may drop it.
          const stateReadsFailure =
            state?.type === 'ObjectPattern' && readsFromPattern(state);
          if (first?.type === 'Identifier' && !stateReadsFailure)
            senders.add(first.name);
        }
        if (SEND_HOOKS.has(hook)) {
          if (node.id.type === 'Identifier') sendObjects.add(node.id.name);
          if (node.id.type === 'ObjectPattern') {
            for (const property of node.id.properties) {
              if (
                property.type === 'Property' &&
                property.key.type === 'Identifier' &&
                property.key.name === 'send' &&
                property.value.type === 'Identifier'
              )
                senders.add(property.value.name);
            }
          }
        }
        if (hook === 'useApolloClient' && node.id.type === 'Identifier')
          clients.add(node.id.name);
      },
      CallExpression(node) {
        calls.push(node);
      },
      'Program:exit'() {
        for (const call of calls) {
          const name = isSendingCall(call);
          if (name) check(call, name);
        }
      },
    };
  },
};
