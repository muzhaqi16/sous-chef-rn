const { selectorRule } = require('../selectorRule');

module.exports = selectorRule({
  name: 'schedule-on-rn-callback',
  description:
    'scheduleOnRN takes a callback defined in RN scope and at most one primitive argument.',
  checks: [
    {
      messageId: 'inlineCallback',
      selector:
        'CallExpression[callee.name="scheduleOnRN"] > :matches(ArrowFunctionExpression, FunctionExpression)',
      message:
        'Do not pass inline functions to scheduleOnRN — define the callback in RN runtime scope first. Inline functions inside worklets cause native crashes on Android.',
    },
    {
      messageId: 'tooManyArguments',
      selector: 'CallExpression[callee.name="scheduleOnRN"][arguments.2]',
      message:
        'scheduleOnRN should have at most 2 arguments (function + one primitive). Functions cannot be serialized across the worklet boundary — capture them via RN-scope closure instead.',
    },
  ],
});
