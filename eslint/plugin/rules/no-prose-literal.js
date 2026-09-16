const { COPY_ATTRIBUTES } = require('../../i18n');
const { isDeveloperFacing } = require('../developerFacing');

const WORDS =
  'message|label|title|subtitle|description|error|text|hint|placeholder|body|caption';
const capitalized = WORDS.split('|')
  .map(word => word[0].toUpperCase() + word.slice(1))
  .join('|');
// `title`, `emptyMessage`, `errorText` — not `context`, which merely ends in "text".
const COPY_NAME = new RegExp(`^(${WORDS})$|[a-z0-9](${capitalized})$`);
// A function whose return is copy: `getEmptyMessage`, `getLabelForField`,
// `formatStatus`, `getDisplayName`. `Error` is left out: `getErrorCategory`.
const COPY_FUNCTION = new RegExp(
  `(${capitalized.replace('|Error', '')})(For[A-Z]\\w*)?$|^format[A-Z]|Name$`,
);
// A diagnostic named for its reader: `logLabel`, `debugMessage`.
const DEVELOPER_NAME = /^(log|debug|dev|internal)[A-Z]/;
// A record whose declared type is a diagnostic: `QueueError`, `MemoryWarning`.
const DIAGNOSTIC_TYPE = /(Error|Warning|LogEntry|Breadcrumb|Diagnostic)$/;
const COPY_SETTER = new RegExp(`^set\\w*(${capitalized})$`);
// yup's message arguments: `.required('…')`, `.matches(re, '…')`.
const SCHEMA_MESSAGE_METHODS = new Set([
  'required',
  'min',
  'max',
  'length',
  'matches',
  'oneOf',
  'notOneOf',
  'email',
  'url',
  'uuid',
  'integer',
  'positive',
  'negative',
  'moreThan',
  'lessThan',
  'typeError',
  'defined',
  'nonNullable',
]);
const JSX_COPY_ATTRIBUTES = new Set(COPY_ATTRIBUTES);

// Two words with letters, or one capitalized word: `'Try again'`, `'Pending'`.
const SENTENCE = /\p{L}[\p{L}'’,.!?:;-]*\s+[\p{L}'’(]/u;
const CAPITALIZED_WORD = /^\p{Lu}\p{Ll}+[.!?…]?$/u;
const NOT_COPY = /^(https?:|mailto:|file:|data:)/;

const isProse = text =>
  !NOT_COPY.test(text) &&
  (SENTENCE.test(text.trim()) || CAPITALIZED_WORD.test(text.trim()));

const isFunction = node =>
  node.type === 'FunctionDeclaration' ||
  node.type === 'FunctionExpression' ||
  node.type === 'ArrowFunctionExpression';

const functionName = fn => {
  if (fn.id) return fn.id.name;
  const parent = fn.parent;
  if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
    return parent.id.name;
  }
  if (
    (parent.type === 'Property' || parent.type === 'MethodDefinition') &&
    !parent.computed &&
    parent.key.type === 'Identifier'
  ) {
    return parent.key.name;
  }
  return undefined;
};

const extendsError = node => {
  let current = node;
  while (current) {
    if (
      (current.type === 'ClassDeclaration' ||
        current.type === 'ClassExpression') &&
      current.superClass?.type === 'Identifier'
    ) {
      return /Error$/.test(current.superClass.name);
    }
    current = current.parent;
  }
  return false;
};

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Copy handed to the UI through a variable, property, setter or return is translated, never an English literal.',
      url: 'docs/rules/no-prose-literal.md',
    },
    schema: [
      {
        type: 'object',
        properties: { followRendered: { type: 'boolean' } },
        additionalProperties: false,
      },
    ],
    messages: {
      prose:
        "English copy assigned to `{{name}}` reaches the screen untranslated in every locale. Add a key to the owning feature's en.json (and es/it/sq) and pass `t(key)`; a developer-facing text belongs in a logger/errorService call or `new Error(…)`.",
    },
  },
  create(context) {
    const services = context.sourceCode.parserServices;
    const checker = services?.program?.getTypeChecker();
    const followRendered = context.options[0]?.followRendered ?? false;
    const sourceCode = context.sourceCode;

    const isCopyName = name =>
      COPY_NAME.test(name) && !DEVELOPER_NAME.test(name);

    const namesDiagnostic = type => {
      const parts = type?.isUnion() ? type.types : [type];
      return parts.some(part => {
        const symbol = part?.aliasSymbol ?? part?.getSymbol();
        return !!symbol && DIAGNOSTIC_TYPE.test(symbol.getName());
      });
    };

    /** The object literal's declared type names a diagnostic record. */
    const isDiagnosticRecord = object =>
      !!checker &&
      object.type === 'ObjectExpression' &&
      namesDiagnostic(
        checker.getContextualType(services.esTreeNodeToTSNodeMap.get(object)),
      );

    /** `error.message = …` on a value typed as an error. */
    const isDiagnosticValue = node =>
      !!checker &&
      namesDiagnostic(
        checker.getTypeAtLocation(services.esTreeNodeToTSNodeMap.get(node)),
      );

    const report = (node, name) =>
      context.report({ node, messageId: 'prose', data: { name } });

    /** Reports every literal a value can evaluate to. */
    const checkValue = (node, name) => {
      if (!node) return;
      switch (node.type) {
        case 'Literal':
          if (typeof node.value === 'string' && isProse(node.value)) {
            if (!isDeveloperFacing(node) && !extendsError(node)) {
              report(node, name);
            }
          }
          return;
        case 'TemplateLiteral': {
          const text = node.quasis.map(q => q.value.cooked ?? '').join(' ');
          if (
            node.quasis.some(q => /\p{L}{2,}/u.test(q.value.cooked ?? '')) &&
            isProse(text) &&
            !isDeveloperFacing(node) &&
            !extendsError(node)
          ) {
            report(node, name);
          }
          return;
        }
        case 'ConditionalExpression':
          checkValue(node.consequent, name);
          checkValue(node.alternate, name);
          return;
        case 'LogicalExpression':
          if (node.operator !== '&&') checkValue(node.left, name);
          checkValue(node.right, name);
          return;
        case 'TSAsExpression':
        case 'TSSatisfiesExpression':
          checkValue(node.expression, name);
          return;
        default:
      }
    };

    /** Whether the value at `start` lands, unchanged or composed, in JSX text or a copy prop. */
    const isRendered = start => {
      let current = start;
      for (;;) {
        const parent = current.parent;
        switch (parent?.type) {
          case 'ChainExpression':
          case 'TSNonNullExpression':
          case 'TemplateLiteral':
            break;
          case 'ConditionalExpression':
            if (parent.test === current) return false;
            break;
          case 'LogicalExpression':
            if (parent.operator === '&&' && parent.left === current) {
              return false;
            }
            break;
          case 'BinaryExpression':
            if (parent.operator !== '+') return false;
            break;
          case 'JSXExpressionContainer': {
            const holder = parent.parent;
            if (holder.type === 'JSXElement' || holder.type === 'JSXFragment') {
              return true;
            }
            if (holder.type !== 'JSXAttribute') return false;
            const name =
              holder.name.type === 'JSXIdentifier' ? holder.name.name : '';
            return JSX_COPY_ATTRIBUTES.has(name) || isCopyName(name);
          }
          default:
            return false;
        }
        current = parent;
      }
    };

    const variableRendered = variable =>
      !!variable &&
      variable.references.some(
        reference => !reference.init && isRendered(reference.identifier),
      );

    const resolve = identifier => {
      let scope = sourceCode.getScope(identifier);
      while (scope) {
        const variable = scope.set.get(identifier.name);
        if (variable) return variable;
        scope = scope.upper;
      }
      return undefined;
    };

    const isUseState = node =>
      node?.type === 'CallExpression' &&
      ((node.callee.type === 'Identifier' && node.callee.name === 'useState') ||
        (node.callee.type === 'MemberExpression' &&
          !node.callee.computed &&
          node.callee.property.type === 'Identifier' &&
          node.callee.property.name === 'useState'));

    /** The rendered state a `useState` setter writes, as its variable name. */
    const renderedStateOfSetter = setter => {
      const variable = resolve(setter);
      const [definition, ...others] = variable?.defs ?? [];
      if (others.length > 0 || definition?.type !== 'Variable') return null;
      const declarator = definition.node;
      if (
        declarator.id.type !== 'ArrayPattern' ||
        !isUseState(declarator.init)
      ) {
        return null;
      }
      const [state, setterElement] = declarator.id.elements;
      if (setterElement !== definition.name || state?.type !== 'Identifier') {
        return null;
      }
      const stateVariable = sourceCode
        .getDeclaredVariables(declarator)
        .find(candidate => candidate.name === state.name);
      return variableRendered(stateVariable) ? state.name : null;
    };

    /** The values a function body can return, nested functions aside. */
    const returnedValues = fn => {
      if (fn.body.type !== 'BlockStatement') return [fn.body];
      const values = [];
      const visit = node => {
        if (!node || typeof node.type !== 'string') return;
        if (isFunction(node)) return;
        if (node.type === 'ReturnStatement') {
          if (node.argument) values.push(node.argument);
          return;
        }
        for (const [key, child] of Object.entries(node)) {
          if (key === 'parent') continue;
          if (Array.isArray(child)) child.forEach(visit);
          else if (child && typeof child === 'object') visit(child);
        }
      };
      fn.body.body.forEach(visit);
      return values;
    };

    /** The binding a function is called through, when the file declares it. */
    const functionVariable = fn => {
      const holder =
        fn.type === 'FunctionDeclaration'
          ? fn
          : fn.parent.type === 'VariableDeclarator' &&
            fn.parent.init === fn &&
            fn.parent.id.type === 'Identifier'
          ? fn.parent
          : null;
      if (!holder) return undefined;
      const name = holder.id?.type === 'Identifier' ? holder.id.name : null;
      return sourceCode
        .getDeclaredVariables(holder)
        .find(candidate => candidate.name === name);
    };

    const returnIsRendered = variable =>
      !!variable &&
      variable.references.some(reference => {
        const call = reference.identifier.parent;
        return (
          call.type === 'CallExpression' &&
          call.callee === reference.identifier &&
          isRendered(call)
        );
      });

    const checkRenderedReturns = fn => {
      const variable = functionVariable(fn);
      if (!variable || COPY_FUNCTION.test(variable.name)) return;
      if (!returnIsRendered(variable)) return;
      for (const value of returnedValues(fn)) checkValue(value, variable.name);
    };

    const renderedHandlers = {
      VariableDeclarator(node) {
        if (node.id.type !== 'ArrayPattern' || !isUseState(node.init)) return;
        const [state] = node.id.elements;
        const [initial] = node.init.arguments;
        if (state?.type !== 'Identifier' || !initial) return;
        const variable = sourceCode
          .getDeclaredVariables(node)
          .find(candidate => candidate.name === state.name);
        if (variableRendered(variable)) checkValue(initial, state.name);
      },
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== 'Identifier' || COPY_SETTER.test(callee.name)) {
          return;
        }
        if (!/^set[A-Z]/.test(callee.name)) return;
        const state = renderedStateOfSetter(callee);
        if (state) checkValue(node.arguments[0], state);
      },
      FunctionDeclaration: checkRenderedReturns,
      FunctionExpression: checkRenderedReturns,
      ArrowFunctionExpression: checkRenderedReturns,
    };

    const keyName = node => {
      if (node.computed) return undefined;
      if (node.key.type === 'Identifier') return node.key.name;
      return typeof node.key.value === 'string' ? node.key.value : undefined;
    };

    const handlers = {
      Property(node) {
        if (node.parent.type === 'ObjectPattern') return;
        const name = keyName(node);
        if (!name || !isCopyName(name)) return;
        if (isDiagnosticRecord(node.parent)) return;
        checkValue(node.value, name);
      },
      PropertyDefinition(node) {
        const name = keyName(node);
        if (name && isCopyName(name)) checkValue(node.value, name);
      },
      VariableDeclarator(node) {
        if (node.id.type === 'Identifier' && isCopyName(node.id.name)) {
          checkValue(node.init, node.id.name);
        }
      },
      AssignmentExpression(node) {
        const target = node.left;
        const name =
          target.type === 'Identifier'
            ? target.name
            : target.type === 'MemberExpression' &&
              !target.computed &&
              target.property.type === 'Identifier'
            ? target.property.name
            : undefined;
        if (!name || !isCopyName(name)) return;
        if (
          target.type === 'MemberExpression' &&
          isDiagnosticValue(target.object)
        ) {
          return;
        }
        checkValue(node.right, name);
      },
      AssignmentPattern(node) {
        const target =
          node.parent.type === 'Property' && node.parent.value === node
            ? node.parent.key
            : node.left;
        if (target.type === 'Identifier' && isCopyName(target.name)) {
          checkValue(node.right, target.name);
        }
      },
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type === 'Identifier' && COPY_SETTER.test(callee.name)) {
          checkValue(node.arguments[0], callee.name);
        }
        if (
          callee.type === 'MemberExpression' &&
          !callee.computed &&
          callee.property.type === 'Identifier' &&
          SCHEMA_MESSAGE_METHODS.has(callee.property.name)
        ) {
          node.arguments.forEach(argument =>
            checkValue(argument, callee.property.name),
          );
        }
      },
      JSXAttribute(node) {
        const name = node.name.type === 'JSXIdentifier' ? node.name.name : '';
        if (!isCopyName(name) || JSX_COPY_ATTRIBUTES.has(name)) return;
        const value =
          node.value?.type === 'JSXExpressionContainer'
            ? node.value.expression
            : node.value;
        checkValue(value, name);
      },
      ReturnStatement(node) {
        let fn = node.parent;
        while (fn && !isFunction(fn)) fn = fn.parent;
        const name = fn && functionName(fn);
        if (name && COPY_FUNCTION.test(name)) checkValue(node.argument, name);
      },
      'ArrowFunctionExpression[expression=true]'(node) {
        const name = functionName(node);
        if (name && COPY_FUNCTION.test(name)) checkValue(node.body, name);
      },
    };
    if (!followRendered) return handlers;
    return {
      ...handlers,
      'VariableDeclarator:exit': renderedHandlers.VariableDeclarator,
      'CallExpression:exit': renderedHandlers.CallExpression,
      FunctionDeclaration: renderedHandlers.FunctionDeclaration,
      FunctionExpression: renderedHandlers.FunctionExpression,
      ArrowFunctionExpression: renderedHandlers.ArrowFunctionExpression,
    };
  },
};
