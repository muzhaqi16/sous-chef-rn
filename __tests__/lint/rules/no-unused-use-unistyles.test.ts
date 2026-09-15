import { testRule } from '#/test-utils/eslintRuleTester';

testRule('no-unused-use-unistyles', {
  valid: ['const { rt } = useUnistyles();'],
  invalid: [{ code: 'useUnistyles();', errors: ['unusedCall'] }],
});
