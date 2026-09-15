import { testRule } from '#/test-utils/eslintRuleTester';

testRule('no-bare-in-memory-cache', {
  valid: [
    'import { makeCache } from "#/test-utils/apolloMockProvider"; const cache = makeCache();',
    'const cache = new InMemoryCache();',
  ],
  invalid: [
    {
      code: 'import { renderWithApollo } from "#/test-utils/apolloMockProvider"; const cache = new InMemoryCache();',
      errors: ['bareCache'],
    },
  ],
});
