const { selectorRule } = require('../selectorRule');

module.exports = selectorRule({
  name: 'no-apollo-react-mock',
  description:
    'Tests render through the Apollo mock provider instead of mocking @apollo/client/react.',
  checks: [
    {
      messageId: 'apolloReactMock',
      selector:
        'CallExpression[callee.object.name="jest"][callee.property.name="mock"][arguments.0.value="@apollo/client/react"]',
      message:
        'Use renderHookWithApollo / renderWithApollo from __tests__/helpers/apolloMockProvider.tsx instead. Direct jest.mock of @apollo/client/react couples tests to operation names, bypasses the real cache, and breaks under refactors. See CLAUDE.md "Apollo Test Patterns" for the migration recipe + 7 gotchas.',
    },
  ],
});
