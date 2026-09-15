import { testRule } from '#/test-utils/eslintRuleTester';

testRule('no-error-message-branching', {
  valid: [
    'declare const error: Error;\nexport const isTimeout = error.name === "TimeoutError";',
    'declare const error: { code?: string };\nexport const forbidden = error.code === "FORBIDDEN";',
    // Narrowing, not branching on text.
    'declare const error: { message?: unknown };\nexport const hasText = typeof error.message === "string";',
    // Two messages compared to each other, and a nullish check.
    'declare const a: { message: string }; declare const b: { message: string };\nexport const same = a.message === b.message;',
    'declare const error: { message?: string };\nexport const has = error.message !== undefined;',
    // A message is logged or wrapped, never searched.
    'declare const error: Error;\nexport const wrapped = new Error(`Refresh failed: ${error.message}`);',
  ],
  invalid: [
    {
      code: 'declare const error: Error;\nexport const offline = error.message.includes("offline");',
      errors: ['messageBranch'],
    },
    {
      code: 'declare const error: Error;\nexport const denied = error.message === "Forbidden";',
      errors: ['messageBranch'],
    },
    {
      code: 'declare const error: Error;\nconst text = error.message.toLowerCase();\nexport const timeout = text.startsWith("timeout");',
      errors: ['messageBranch'],
    },
    {
      code: 'declare const error: unknown;\nconst text = error instanceof Error ? error.message : String(error);\nexport const network = /network/i.test(text);',
      errors: ['messageBranch'],
    },
    {
      code: 'export function isCacheError(message: string) {\n  return message.includes("Missing field");\n}',
      errors: ['messageBranch'],
    },
    {
      code: 'declare const error: Error;\nconst { message } = error;\nexport const socket = message.includes("socket");',
      errors: ['messageBranch'],
    },
  ],
});
