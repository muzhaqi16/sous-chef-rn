import { testRule } from '#/test-utils/eslintRuleTester';

testRule('no-dated-comment', {
  valid: [
    '// The server resolves a bare unit symbol to a real unit.\nconst a = 1;',
    '/** A calendar day as the machine key `2026-09-03`. */\nconst b = 1;',
    "const c = '2026-09-03';",
  ],
  invalid: [
    {
      code: '// Re-recorded 2026-09-13: the policies were retyped.\nconst a = 1;',
      errors: ['datedComment'],
    },
    {
      code: '/**\n * Since 2026-08-22 the server resolves units.\n */\nconst b = 1;',
      errors: ['datedComment'],
    },
  ],
});
