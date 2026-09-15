import { testRule } from '#/test-utils/eslintRuleTester';

testRule('no-apollo-react-mock', {
  valid: ['jest.mock("#/services/haptic");'],
  invalid: [
    { code: 'jest.mock("@apollo/client/react");', errors: ['apolloReactMock'] },
  ],
});
