const { readReplayPreparationDocuments } = require('../replayPreparations');

/** The object a call passes as its options, following a `const` if it is one. */
function optionsObject(node, scope) {
  if (!node) return undefined;
  if (node.type === 'ObjectExpression') return node;
  if (node.type !== 'Identifier') return undefined;
  const variable = scope.references.find(
    reference => reference.identifier === node,
  )?.resolved;
  const declarator = variable?.defs[0]?.node;
  return declarator?.type === 'VariableDeclarator' &&
    declarator.init?.type === 'ObjectExpression'
    ? declarator.init
    : undefined;
}

/** The value of the object's own `key` property. */
function ownProperty(object, key) {
  if (!object || object.type !== 'ObjectExpression') return undefined;
  return object.properties.find(
    p =>
      p.type === 'Property' &&
      (p.key.type === 'Identifier'
        ? p.key.name
        : p.key.type === 'Literal'
        ? String(p.key.value)
        : undefined) === key,
  );
}

/** Whether the object, at any depth, sets `key` — optionally to `true`. */
function sets(object, key, requireTrue) {
  if (!object || object.type !== 'ObjectExpression') return false;
  return object.properties.some(property => {
    if (property.type !== 'Property') return false;
    const name =
      property.key.type === 'Identifier'
        ? property.key.name
        : property.key.type === 'Literal'
        ? String(property.key.value)
        : undefined;
    if (name === key) {
      return requireTrue
        ? property.value.type === 'Literal' && property.value.value === true
        : true;
    }
    return sets(property.value, key, requireTrue);
  });
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A write the offline queue can take writes the cache first and says so.',
      url: 'docs/rules/queueable-write-is-local-first.md',
    },
    schema: [],
    messages: {
      missingLocalFirst:
        '`{{document}}` is in REPLAY_PREPARATIONS, so `queueLink` queues this write offline whether or not you asked. Without `context: { localFirst: true }` the caller skipped the local write: it settles `queued`, the sheet closes, the list keeps the old value, and a restart has nothing to restore. Write the cache first, then pass the marker.',
      redundantLocalFirst:
        'This `useMutation` already sets `context: { localFirst: true }`, so the per-call marker is redundant. Drop it; to add another context key, use the callback form `context: hookContext => ({ ...hookContext, key })`.',
      contextDropsLocalFirst:
        'A per-call `context` object REPLACES the `useMutation` context, so this call drops `localFirst: true` and is no longer queued as local-first. Use the callback form `context: hookContext => ({ ...hookContext, key })`.',
      optimisticWithLocalFirst:
        'Do not pair `optimisticResponse` with `localFirst: true`. A queued write completes at once with a null result, and Apollo drops the optimistic layer on completion — so the change flashes on screen and vanishes. The local cache write IS the optimistic update here.',
    },
  },
  create(context) {
    const queueable = readReplayPreparationDocuments();
    const sourceCode = context.sourceCode;

    /** `fire` → { document, hookOptions, hookLocalFirst } for every `useMutation`. */
    const fired = new Map();

    const documentNameOf = node =>
      node?.type === 'Identifier' && queueable.has(node.name)
        ? node.name
        : undefined;

    // A call's object `context` replaces the hook's; the callback form and an
    // absent `context` keep it (Apollo 4.1+, `useMutation`'s execute).
    const checkCall = (node, { document, hookOptions, hookLocalFirst }) => {
      const scope = sourceCode.getScope(node);
      const options = optionsObject(node.arguments[0], scope);
      const callContext = ownProperty(options, 'context')?.value;
      const callMarker =
        callContext?.type === 'ObjectExpression'
          ? ownProperty(callContext, 'localFirst')
          : undefined;
      const callLocalFirst =
        callMarker?.value.type === 'Literal' && callMarker.value.value === true;
      const replacesHookContext = callContext?.type === 'ObjectExpression';
      const localFirst =
        callLocalFirst || (hookLocalFirst && !replacesHookContext);

      if (hookLocalFirst && callMarker) {
        context.report({ node: callMarker, messageId: 'redundantLocalFirst' });
      } else if (hookLocalFirst && replacesHookContext) {
        context.report({
          node: callContext,
          messageId: 'contextDropsLocalFirst',
        });
      }

      if (!localFirst) {
        if (document) {
          context.report({
            node,
            messageId: 'missingLocalFirst',
            data: { document },
          });
        }
        return;
      }
      if (
        sets(options, 'optimisticResponse', false) ||
        sets(hookOptions, 'optimisticResponse', false)
      ) {
        context.report({ node, messageId: 'optimisticWithLocalFirst' });
      }
    };

    return {
      // `const [fire] = useMutation(XDocument, options)`
      'VariableDeclarator[init.callee.name="useMutation"]'(node) {
        const [binding] =
          node.id.type === 'ArrayPattern' ? node.id.elements : [];
        if (binding?.type !== 'Identifier') return;
        const hookOptions = optionsObject(
          node.init.arguments[1],
          sourceCode.getScope(node),
        );
        const hookContext = ownProperty(hookOptions, 'context')?.value;
        const hookMarker = ownProperty(hookContext, 'localFirst')?.value;
        fired.set(binding.name, {
          document: documentNameOf(node.init.arguments[0]),
          hookOptions,
          hookLocalFirst:
            hookMarker?.type === 'Literal' && hookMarker.value === true,
        });
      },

      // `client.mutate({ mutation: XDocument, … })`
      'CallExpression[callee.property.name="mutate"]'(node) {
        const options = optionsObject(
          node.arguments[0],
          sourceCode.getScope(node),
        );
        const mutation = options?.properties.find(
          property =>
            property.type === 'Property' &&
            property.key.type === 'Identifier' &&
            property.key.name === 'mutation',
        );
        const document = documentNameOf(mutation?.value);
        if (!document) return;
        if (!sets(options, 'localFirst', true)) {
          context.report({
            node,
            messageId: 'missingLocalFirst',
            data: { document },
          });
        } else if (sets(options, 'optimisticResponse', false)) {
          context.report({ node, messageId: 'optimisticWithLocalFirst' });
        }
      },

      // Every `fire(…)`, once the whole file has been walked.
      'Program:exit'(program) {
        const visit = node => {
          if (
            node.type === 'CallExpression' &&
            node.callee.type === 'Identifier' &&
            fired.has(node.callee.name)
          ) {
            checkCall(node, fired.get(node.callee.name));
          }
          for (const key of sourceCode.visitorKeys[node.type] ?? []) {
            const child = node[key];
            if (Array.isArray(child)) child.forEach(c => c && visit(c));
            else if (child && typeof child.type === 'string') visit(child);
          }
        };
        visit(program);
      },
    };
  },
};
