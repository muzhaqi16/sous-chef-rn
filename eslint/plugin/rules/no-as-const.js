const { selectorRule } = require('../selectorRule');

module.exports = selectorRule({
  name: 'no-as-const',
  description:
    'Let TypeScript infer literal types instead of asserting as const.',
  checks: [
    {
      messageId: 'asConst',
      selector:
        'TSAsExpression[typeAnnotation.type="TSTypeReference"][typeAnnotation.typeName.name="const"]',
      message:
        'Avoid `as const` — let TypeScript infer literal types naturally. Use `as const` only for union type derivation or discriminated unions.',
    },
  ],
});
