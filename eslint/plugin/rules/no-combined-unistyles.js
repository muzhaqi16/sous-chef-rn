const { selectorRule } = require('../selectorRule');

module.exports = selectorRule({
  name: 'no-combined-unistyles',
  description:
    'One element takes one Unistyles style; combine through variants.',
  checks: [
    {
      messageId: 'combinedStyles',
      selector:
        'ArrayExpression > MemberExpression[object.name="styles"] ~ MemberExpression[object.name="styles"]',
      message:
        "Avoid combining multiple `styles.*` on the same element — Unistyles v3 proxies break when spread by reanimated's StyleSheet.flatten(). Use `styles.useVariants()` instead.",
    },
  ],
});
