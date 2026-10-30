import { testTypedRule } from '#/test-utils/eslintRuleTester';

testTypedRule('no-operation-name-literal', {
  valid: [
    // A label that shares an operation's spelling in a slot that is not one.
    'declare function useScreenTransition(screenName: string): void;\nuseScreenTransition("MyRecipes");',
    // A literal-union slot is checked by tsc.
    'declare function send(operationName: "GetPantry" | "GetHomes"): void;\nsend("GetPantry");',
    // Not an operation name.
    'const operationName = "NotAnOperation";',
  ],
  invalid: [
    {
      code: 'declare const operation: { operationName: string };\nexport const isRefresh = operation.operationName !== "RefreshToken";',
      errors: ['operationNameLiteral'],
    },
    {
      code: 'export const publicOperations = ["Login", "Register"];',
      errors: ['operationNameLiteral', 'operationNameLiteral'],
    },
    {
      code: 'declare function register(config: { subscriptionName: string }): void;\nregister({ subscriptionName: "PantryEvents" });',
      errors: ['operationNameLiteral'],
    },
    {
      code: 'declare function logError(operationName: string): void;\nlogError(`GetPantry`);',
      errors: ['operationNameLiteral'],
    },
  ],
});
