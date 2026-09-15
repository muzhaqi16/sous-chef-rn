import { testRule } from '#/test-utils/eslintRuleTester';

testRule('no-modal-props-override', {
  valid: [
    'const a = <BottomSheetModal {...modalProps} snapPoints={points} />;',
  ],
  invalid: [
    {
      code: 'const a = <BottomSheetModal {...modalProps} onChange={f} />;',
      errors: ['modalPropsOverride'],
    },
    {
      code: 'const a = <BottomSheetModal {...modalProps} animatedIndex={g} />;',
      errors: ['modalPropsOverride'],
    },
  ],
});
