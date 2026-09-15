import { testRule } from '#/test-utils/eslintRuleTester';

testRule('no-untranslated-toast', {
  valid: ['toastService.show(t("pantry.saved"));', 'toastService.show("✕");'],
  invalid: [
    { code: 'toastService.show("Hello world");', errors: ['literal'] },
    { code: 'alertService.alert(error.message);', errors: ['serverMessage'] },
    { code: 'toastService.show(`Hi ${name}`);', errors: ['templateLiteral'] },
  ],
});
