import { testRule } from '#/test-utils/eslintRuleTester';

testRule('no-as-const', {
  valid: ['const steps = { a: 1 } satisfies Record<string, number>;'],
  invalid: [{ code: 'const steps = [1, 2] as const;', errors: ['asConst'] }],
});
