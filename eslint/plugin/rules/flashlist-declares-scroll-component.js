/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Every FlashList declares which scroll component it renders through.',
      url: 'docs/rules/flashlist-declares-scroll-component.md',
    },
    schema: [],
    messages: {
      undeclared:
        "This FlashList declares no `renderScrollComponent`, so it renders through React Native's ScrollView. RNGH answers a native view grabbing the touch stream with `cancelAllLegacyHandlers()` — v1 and v2 only — so a row's `ReanimatedSwipeable` or RNGH `Pressable` survives the takeover: the swipe opens mid-scroll and a press fires on a finger that only stopped a fling. Pass `SwipeAwareScrollComponent`, or `BottomSheetScrollable` inside a sheet. If the rows carry no RNGH gesture, exempt the file in eslint/project.js with the reason.",
    },
  },
  create(context) {
    return {
      'JSXElement[openingElement.name.name="FlashList"]'(node) {
        const declares = node.openingElement.attributes.some(
          attribute =>
            attribute.type === 'JSXAttribute' &&
            attribute.name.type === 'JSXIdentifier' &&
            attribute.name.name === 'renderScrollComponent',
        );
        if (!declares) {
          context.report({
            node: node.openingElement,
            messageId: 'undeclared',
          });
        }
      },
    };
  },
};
