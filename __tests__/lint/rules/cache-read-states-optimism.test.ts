import { testRule } from '#/test-utils/eslintRuleTester';

testRule('cache-read-states-optimism', {
  valid: [
    'cache.readFragment({ id, fragment, optimistic: true });',
    'cache.readQuery({ query, optimistic: false });',
    'cache.diff({ query, optimistic: false });',
    'cache.readFragment({ ...options });',
    'list.read({ id });',
    'later.diff(earlier);',
  ],
  invalid: [
    {
      code: 'cache.readFragment({ id, fragment });',
      output: 'cache.readFragment({ id, fragment, optimistic: true });',
      errors: ['statesOptimism'],
    },
    {
      code: 'cache.readQuery({ query });',
      output: 'cache.readQuery({ query, optimistic: true });',
      errors: ['statesOptimism'],
    },
    {
      code: 'cache.readFragment(options);',
      output: null,
      errors: ['statesOptimism'],
    },
  ],
});
