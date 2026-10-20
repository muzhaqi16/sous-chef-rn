import { testRule } from '#/test-utils/eslintRuleTester';

testRule('no-module-scope-platform-read', {
  valid: [
    "const secureStore = () => requirePlatform('secureStore');",
    "function read() { return requirePlatform('environment'); }",
    "export function useIntents() { return requirePlatform('screen').useNavigationIntents(); }",
    "const store = { get os() { return requirePlatform('platformInfo').os; } };",
  ],
  invalid: [
    {
      code: "const secureStore = requirePlatform('secureStore');",
      errors: ['moduleScopeRead'],
    },
    {
      code: "export const VERSION = requirePlatform('platformInfo').appVersion;",
      errors: ['moduleScopeRead'],
    },
    {
      code: "export const { useNavigationIntents } = requirePlatform('screen');",
      errors: ['moduleScopeRead'],
    },
    {
      code: "const DEFAULTS = { platform: requirePlatform('platformInfo').os };",
      errors: ['moduleScopeRead'],
    },
  ],
});
