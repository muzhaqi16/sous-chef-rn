const { selectorRule } = require('../selectorRule');

module.exports = selectorRule({
  name: 'no-shared-value-assignment',
  description: 'Write a SharedValue with .set(), never by assigning .value.',
  checks: [
    {
      messageId: 'valueAssignment',
      selector:
        'AssignmentExpression[left.type="MemberExpression"][left.property.name="value"]',
      message:
        'Use .set() instead of .value assignment for SharedValues (React Compiler compatibility). If this is not a SharedValue, refactor to avoid .value mutation.',
    },
  ],
});
