import { testTypedRule } from '#/test-utils/eslintRuleTester';

const PRELUDE = `
type ApolloError = { message: string };
type NetworkStatus = number;
`;

const code = (body: string) => `${PRELUDE}${body}\n`;

testTypedRule('hook-returns-no-library-type', {
  valid: [
    // Plain values and callbacks.
    code(
      'export const useThing = (): { message: string; retry: () => void } => ({ message: "", retry: () => {} });',
    ),
    // Not a hook: the name decides.
    code(
      'export const buildThing = (): { error: ApolloError | undefined } => ({ error: undefined });',
    ),
    // Not exported, so no screen can reach it.
    code(
      'const useInternal = (): { error: ApolloError | undefined } => ({ error: undefined });\nexport const useThing = () => useInternal().error?.message;',
    ),
  ],
  invalid: [
    {
      code: code(
        'export const useThing = (): { error: ApolloError | undefined } => ({ error: undefined });',
      ),
      errors: ['libraryType'],
    },
    {
      // A leak one level down is what the property walk exists for.
      code: code(
        'export function useThing(): { status: NetworkStatus } {\n  return { status: 7 };\n}',
      ),
      errors: ['libraryType'],
    },
  ],
});
