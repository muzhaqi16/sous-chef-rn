import { testRule } from '#/test-utils/eslintRuleTester';

testRule('no-imperative-sheet', {
  valid: ['Keyboard.dismiss();', 'sheetRef.present(options);'],
  invalid: [
    { code: 'sheetRef.present();', errors: ['imperativeSheet'] },
    { code: 'modalRef.current.dismiss();', errors: ['imperativeSheet'] },
  ],
});
