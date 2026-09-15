import { testRule } from '#/test-utils/eslintRuleTester';

testRule('no-module-level-t', {
  valid: [
    'import { t as tGlobal } from "#/i18n";',
    'import { useTranslation } from "#/i18n";',
  ],
  invalid: [{ code: 'import { t } from "#/i18n";', errors: ['moduleLevelT'] }],
});
