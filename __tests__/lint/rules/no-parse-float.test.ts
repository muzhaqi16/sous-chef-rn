import { testRule } from '#/test-utils/eslintRuleTester';

testRule('no-parse-float', {
  valid: ['parseDecimalInput("4,99");', 'Number.parseInt("4", 10);'],
  invalid: [
    { code: 'parseFloat("1");', errors: ['parseFloat'] },
    { code: 'Number.parseFloat("1");', errors: ['parseFloat'] },
  ],
});
