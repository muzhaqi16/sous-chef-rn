const { selectorRule } = require('../selectorRule');

module.exports = selectorRule({
  name: 'no-legacy-shadow-props',
  description:
    'Shadows use boxShadow from a theme.shadows step, not the individual shadow* properties.',
  checks: [
    {
      messageId: 'legacyShadowProp',
      selector:
        ':matches(Property[key.name="shadowColor"], Property[key.name="shadowOffset"], Property[key.name="shadowOpacity"], Property[key.name="shadowRadius"])',
      message:
        'Use CSS boxShadow syntax instead of individual shadow properties. See src/styles/listStyles.ts for the correct pattern.',
    },
  ],
});
