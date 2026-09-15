const { selectorRule } = require('../selectorRule');

module.exports = selectorRule({
  name: 'no-unused-use-unistyles',
  description: 'useUnistyles() is called for its return value.',
  checks: [
    {
      messageId: 'unusedCall',
      selector:
        'ExpressionStatement > CallExpression[callee.name="useUnistyles"]',
      message:
        'useUnistyles() called without using its return value has no effect. Destructure what you need: `const { theme } = useUnistyles()`.',
    },
  ],
});
