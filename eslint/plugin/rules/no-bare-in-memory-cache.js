const { selectorRule } = require('../selectorRule');

module.exports = selectorRule({
  name: 'no-bare-in-memory-cache',
  description:
    'A suite using the Apollo mock provider builds its cache with makeCache().',
  checks: [
    {
      messageId: 'bareCache',
      selector:
        'Program:has(ImportDeclaration[source.value=/apolloMockProvider$/]) NewExpression[callee.name="InMemoryCache"]',
      message:
        'Use makeCache() from __tests__/helpers/apolloMockProvider (or let renderWithApollo build it). A bare InMemoryCache has no type policies and no possibleTypes, so the suite exercises a cache the app never runs.',
    },
  ],
});
