import { testRule } from '#/test-utils/eslintRuleTester';

testRule('no-raw-spacing', {
  valid: [
    'const a = { padding: theme.spacing.md };',
    "const b = { marginTop: -theme.spacing['2xs'] };",
    'const c = { gap: 0, margin: 0 };',
    'const d = { paddingRight: theme.sizes.button.md + theme.spacing.sm };',
    // Not a spacing property.
    'const e = { width: 280, borderRadius: 8 };',
  ],
  invalid: [
    { code: 'const a = { padding: 2 };', errors: ['rawSpacing'] },
    { code: 'const b = { marginTop: -2 };', errors: ['rawSpacing'] },
    {
      code: 'const c = { gap: 3, paddingHorizontal: 12 };',
      errors: ['rawSpacing', 'rawSpacing'],
    },
  ],
});
