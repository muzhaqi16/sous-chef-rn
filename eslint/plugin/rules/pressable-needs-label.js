const { selectorRule } = require('../selectorRule');

module.exports = selectorRule({
  name: 'pressable-needs-label',
  description: 'A pressable with no text child carries an accessibilityLabel.',
  checks: [
    {
      messageId: 'missingLabel',
      selector:
        'JSXElement[openingElement.name.name=/^(AppPressable|Pressable|TouchableOpacity|TouchableHighlight)$/]:has(JSXOpeningElement > JSXAttribute[name.name="onPress"]):not(:has(JSXOpeningElement > JSXAttribute[name.name=/^(accessibilityLabel|aria-label|accessible)$/])):not(:has(JSXElement > JSXExpressionContainer)):not(:has(JSXElement[openingElement.name.name=/Text$/])):not(:has(JSXElement[openingElement.name.property.name="Text"])):not(:has(JSXText[value=/\\S/]))',
      message:
        'A control with no text child needs an `accessibilityLabel` — a screen reader announces it as "button" and nothing else. Give it a label, put a `<Text>` in it, or mark it `accessible={false}` if it is decorative.',
    },
  ],
});
