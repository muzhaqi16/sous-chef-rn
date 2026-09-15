import { testRule } from '#/test-utils/eslintRuleTester';

testRule('pressable-needs-label', {
  valid: [
    'const a = <Pressable onPress={f} accessibilityLabel={t("close")}><Icon /></Pressable>;',
    'const b = <Pressable onPress={f}><Text>{label}</Text></Pressable>;',
  ],
  invalid: [
    {
      code: 'const a = <Pressable onPress={f}><Icon /></Pressable>;',
      errors: ['missingLabel'],
    },
  ],
});
