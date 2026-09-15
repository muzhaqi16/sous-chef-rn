import { testRule } from '#/test-utils/eslintRuleTester';

testRule('no-shared-value-assignment', {
  valid: ['progress.set(1);', 'const v = progress.value;'],
  invalid: [{ code: 'progress.value = 1;', errors: ['valueAssignment'] }],
});
