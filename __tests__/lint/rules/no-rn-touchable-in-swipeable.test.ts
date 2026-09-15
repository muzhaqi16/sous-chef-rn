import { testRule } from '#/test-utils/eslintRuleTester';

testRule('no-rn-touchable-in-swipeable', {
  valid: [
    'const a = <SwipeableItem><Pressable onPress={f} /></SwipeableItem>;',
  ],
  invalid: [
    {
      code: 'const a = <SwipeableItem><AppPressable onPress={f} /></SwipeableItem>;',
      errors: ['rnTouchable'],
    },
  ],
});
