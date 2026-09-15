import { testRule } from '#/test-utils/eslintRuleTester';

testRule('no-font-scale-override', {
  valid: [
    'const a = <Text role="body" />;',
    'const b = <Text allowFontScaling />;',
  ],
  invalid: [
    {
      code: 'const a = <Text maxFontSizeMultiplier={1.2} />;',
      errors: ['maxFontSizeMultiplier'],
    },
    {
      code: 'const b = <Text allowFontScaling={false} />;',
      errors: ['allowFontScaling'],
    },
  ],
});
