import { testRule } from '#/test-utils/eslintRuleTester';

testRule('no-combined-unistyles', {
  valid: ['const a = <View style={[styles.row, style]} />;'],
  invalid: [
    {
      code: 'const a = <View style={[styles.a, styles.b]} />;',
      errors: ['combinedStyles'],
    },
  ],
});
