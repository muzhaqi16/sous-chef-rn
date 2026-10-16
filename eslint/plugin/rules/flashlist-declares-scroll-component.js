/**
 * The only hosts that carry RNGH's gesture into a FlashList: a presence check
 * alone passes `renderScrollComponent={ScrollView}`, which drops the host's
 * gesture and its `nestedScrollEnabled={false}`.
 */
const SCROLL_HOSTS = new Set([
  'SwipeAwareScrollComponent',
  'BottomSheetScrollable',
]);

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
        "This FlashList declares no `renderScrollComponent`, so it renders through React Native's ScrollView. `ThemedRefreshControl` throws in that host, and the rows' RNGH gestures meet the scroll only through RNGH's takeover cancellation, never its orchestrator. Pass `SwipeAwareScrollComponent`, or `BottomSheetScrollable` inside a sheet. If the rows carry no RNGH gesture, exempt the file in eslint/project.js with the reason.",
      wrongHost:
        "`renderScrollComponent` names a host that does not carry RNGH's gesture, so the list behaves as if it were absent: `ThemedRefreshControl` has no RNGH host and the shared `nestedScrollEnabled={false}` is lost. Pass `SwipeAwareScrollComponent`, or `BottomSheetScrollable` inside a sheet.",
    },
  },
  create(context) {
    return {
      'JSXElement[openingElement.name.name="FlashList"]'(node) {
        const declared = node.openingElement.attributes.find(
          attribute =>
            attribute.type === 'JSXAttribute' &&
            attribute.name.type === 'JSXIdentifier' &&
            attribute.name.name === 'renderScrollComponent',
        );
        if (!declared) {
          context.report({
            node: node.openingElement,
            messageId: 'undeclared',
          });
          return;
        }
        const value = declared.value;
        const names =
          value?.type === 'JSXExpressionContainer' &&
          value.expression.type === 'Identifier'
            ? value.expression.name
            : null;
        if (!names || !SCROLL_HOSTS.has(names)) {
          context.report({ node: declared, messageId: 'wrongHost' });
        }
      },
    };
  },
};
