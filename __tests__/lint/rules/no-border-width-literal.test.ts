import { testRule } from '#/test-utils/eslintRuleTester';

testRule('no-border-width-literal', {
  valid: ['const s = { borderWidth: theme.borderWidth.hairline };'],
  invalid: [
    { code: 'const s = { borderWidth: 1 };', errors: ['borderWidthLiteral'] },
    {
      code: 'const s = { borderTopWidth: 0.5 };',
      errors: ['borderWidthLiteral'],
    },
  ],
});
