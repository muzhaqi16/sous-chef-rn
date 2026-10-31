/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A direct cache read states whether it sees pending writes, since Apollo defaults to the server data alone.',
      url: 'docs/rules/cache-read-states-optimism.md',
    },
    fixable: 'code',
    schema: [],
    messages: {
      statesOptimism:
        'State `optimistic`: `true` for a read of what the person sees, `false` for one whose result reaches the server data (a link answer, a replay). The default reads past every pending write.',
    },
  },
  create(context) {
    return {
      'CallExpression[callee.property.name=/^(readFragment|readQuery|diff)$/]'(
        node,
      ) {
        const [options] = node.arguments;
        if (!options) return;
        const isObject = options.type === 'ObjectExpression';
        // `diff` is also a date library's method; only the cache's takes options.
        if (!isObject && node.callee.property.name === 'diff') return;
        if (
          isObject &&
          options.properties.some(
            property =>
              property.type === 'SpreadElement' ||
              property.key?.name === 'optimistic',
          )
        ) {
          return;
        }
        const last = isObject ? options.properties.at(-1) : undefined;
        context.report({
          node,
          messageId: 'statesOptimism',
          fix: last
            ? fixer => fixer.insertTextAfter(last, ', optimistic: true')
            : null,
        });
      },
    };
  },
};
