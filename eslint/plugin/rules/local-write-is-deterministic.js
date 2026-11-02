const IN_LOCAL_WRITE = 'Property[key.name=/^(apply|commit)$/]';

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        "A local write's `apply` and `commit` read only their write and the cache, and hide a row without `evict` or `gc`.",
      url: 'docs/rules/local-write-is-deterministic.md',
    },
    schema: [],
    messages: {
      outsideInput:
        '`{{name}}` gives another answer on the next rebuild: a local write re-runs whenever the server data under it changes, and after a restart. Read it once in `capture`, and from `write.inputs` here.',
      evictsInLayer:
        '`{{name}}` in a layer leaves a row the server data holds. Hide it with `cache.modify` and `DELETE`, or filter it from its lists. Verified: #apollo-an-optimistic-layer-copies-the-whole-entity.',
    },
  },
  create(context) {
    const outsideInput = (node, name) =>
      context.report({ node, messageId: 'outsideInput', data: { name } });
    return {
      [`${IN_LOCAL_WRITE} NewExpression[callee.name='Date']`](node) {
        outsideInput(node, 'new Date');
      },
      [`${IN_LOCAL_WRITE} MemberExpression[object.name='Date']`](node) {
        outsideInput(node, 'Date');
      },
      [`${IN_LOCAL_WRITE} CallExpression[callee.name=/^(generateEntityId|generateId|requirePlatform)$/]`](
        node,
      ) {
        outsideInput(node, node.callee.name);
      },
      [`${IN_LOCAL_WRITE} MemberExpression[object.name=/^(useStore|storeApi)$/]`](
        node,
      ) {
        outsideInput(node, node.object.name);
      },
      [`${IN_LOCAL_WRITE} CallExpression[callee.property.name=/^(evict|gc)$/]`](
        node,
      ) {
        context.report({
          node,
          messageId: 'evictsInLayer',
          data: { name: node.callee.property.name },
        });
      },
    };
  },
};
