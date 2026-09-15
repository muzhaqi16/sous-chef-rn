import { testRule } from '#/test-utils/eslintRuleTester';

testRule('no-inline-import-type', {
  valid: ['import type { Thing } from "./other"; type T = Thing;'],
  invalid: [
    { code: 'type T = import("./other").Thing;', errors: ['inlineImportType'] },
  ],
});
