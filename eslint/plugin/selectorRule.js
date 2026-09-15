/**
 * Builds a rule from esquery selectors: each check reports the node its
 * selector matches, with its own messageId. ESLint accepts a selector string
 * as a listener key, so matching is exactly `no-restricted-syntax`'s.
 */
function selectorRule({ name, description, checks }) {
  return {
    meta: {
      type: 'problem',
      docs: { description, url: `docs/rules/${name}.md` },
      schema: [],
      messages: Object.fromEntries(checks.map(c => [c.messageId, c.message])),
    },
    create(context) {
      return Object.fromEntries(
        checks.map(c => [
          c.selector,
          node => context.report({ node, messageId: c.messageId }),
        ]),
      );
    },
  };
}

module.exports = { selectorRule };
