import { testRule } from '#/test-utils/eslintRuleTester';

testRule('no-legacy-shadow-props', {
  valid: ['const s = { ...theme.shadows.md };'],
  invalid: [
    {
      code: 'const s = { shadowColor: "black" };',
      errors: ['legacyShadowProp'],
    },
    { code: 'const s = { shadowRadius: 3 };', errors: ['legacyShadowProp'] },
  ],
});
