const { selectorRule } = require('../selectorRule');

module.exports = selectorRule({
  name: 'no-parse-float',
  description: 'Parse typed numbers with parseDecimalInput, never parseFloat.',
  checks: [
    {
      messageId: 'parseFloat',
      selector:
        "CallExpression[callee.name='parseFloat'], CallExpression[callee.property.name='parseFloat']",
      message:
        'Use parseDecimalInput from #/utils/parseDecimalInput instead of parseFloat. parseFloat reads "4,99" as 4 on any device whose keyboard offers a comma, silently saving a wrong number. If this value is machine-generated and never typed, both behave identically — so use parseDecimalInput regardless.',
    },
  ],
});
