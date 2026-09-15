const { selectorRule } = require('../selectorRule');

module.exports = selectorRule({
  name: 'no-rn-touchable-in-swipeable',
  description:
    "Controls inside a Swipeable use RNGH's Pressable, not RN-based touchables.",
  checks: [
    {
      messageId: 'rnTouchable',
      selector:
        'JSXElement[openingElement.name.name=/^(SwipeableItem|ReanimatedSwipeable)$/] JSXElement[openingElement.name.name=/^(AppPressable|PressableScale|TouchableOpacity|TouchableHighlight|TouchableWithoutFeedback|TouchableNativeFeedback)$/]',
      message:
        "Interactive controls inside a Swipeable must use RNGH's Pressable (`import { Pressable } from 'react-native-gesture-handler'`), not AppPressable/PressableScale/Touchable*. RN touchables don't coordinate with RNGH's gesture arena — they block the swipe or double-fire the row's onPress. See CLAUDE.md \"Pressable & Modal Convention\".",
    },
  ],
});
