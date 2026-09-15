import { testRule } from '#/test-utils/eslintRuleTester';

testRule('no-hand-rolled-search', {
  valid: [
    'filterByTerm(items, term, i => i.name);',
    'items.filter(i => i.done);',
  ],
  invalid: [
    {
      code: 'items.filter(i => i.name.toLowerCase().includes(term));',
      errors: ['handRolledSearch'],
    },
  ],
});
