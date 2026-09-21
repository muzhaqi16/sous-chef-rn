const attribute = (element, name) =>
  element.attributes.find(
    candidate =>
      candidate.type === 'JSXAttribute' &&
      candidate.name.type === 'JSXIdentifier' &&
      candidate.name.name === name,
  );

const tagName = node =>
  node.type === 'JSXIdentifier'
    ? node.name
    : node.type === 'JSXMemberExpression'
    ? tagName(node.property)
    : '';

/** Whether the attribute's value renders `<ThemedRefreshControl>` anywhere. */
const rendersThemedControl = attr => {
  if (!attr?.value || attr.value.type !== 'JSXExpressionContainer')
    return false;
  let found = false;
  const walk = node => {
    if (!node || typeof node.type !== 'string' || found) return;
    if (
      node.type === 'JSXElement' &&
      tagName(node.openingElement.name) === 'ThemedRefreshControl'
    ) {
      found = true;
      return;
    }
    for (const key of Object.keys(node)) {
      // `parent` points back up the tree; following it never terminates.
      if (key === 'parent') continue;
      const child = node[key];
      if (Array.isArray(child)) child.forEach(walk);
      else if (child && typeof child.type === 'string') walk(child);
    }
  };
  walk(attr.value.expression);
  return found;
};

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        "A pull-to-refresh control matches its scrollable host: RNGH's or React Native's.",
      url: 'docs/rules/rngh-refresh-control-matches-host.md',
    },
    schema: [],
    messages: {
      bareOnRefresh:
        "This list offers pull-to-refresh through a bare `onRefresh`, so FlashList builds the control itself (`useSecondaryProps`, `else if (onRefresh)`) — and the one it builds is React Native's. RNGH's ScrollView hands its scroll gesture on as `cloneElement(refreshControl, { block })`, which only a control built by `createNativeWrapper` routes into `useNativeGesture`: on RN's the prop is inert, no error and no warning, and the spinner hangs mid-list. Pass an explicit `refreshControl={<ThemedRefreshControl … />}`.",
      wrongControl:
        'This list passes a `refreshControl` that is not `ThemedRefreshControl`. Only the RNGH-based control takes the scroll gesture its host hands on.',
      rnImportWithRnghHost:
        "This file has an RNGH scrollable host, so React Native's `RefreshControl` must not be reachable here by name. Use `ThemedRefreshControl`.",
      themedControlWithoutRnghHost:
        '`ThemedRefreshControl` wraps RNGH\'s control, which renders a `VirtualDetector` whose first statement throws "VirtualGestureDetector must be a descendant of an InterceptingGestureDetector" when no RNGH scrollable is above it. This file has none, so this does not merely lose arbitration — it takes the screen down. `PlainScrollRefreshControl` is the counterpart for a plain RN host.',
      handRolledRnghScroller:
        "A hand-rolled RNGH `ScrollView` with pull-to-refresh parks its spinner on Android: RN turns `nestedScrollEnabled` on for any ScrollView carrying a `refreshControl`, which lets `SwipeRefreshLayoutHook` fail the handler mid-pull, and androidx's `SwipeRefreshLayout` ignores the resulting ACTION_CANCEL. Render through `SwipeAwareScrollComponent`, where the `nestedScrollEnabled={false}` override lives.",
    },
  },
  create(context) {
    let importsRnRefreshControl = null;
    let importsRnghScrollView = false;
    let rendersSharedHost = false;
    const flashLists = [];
    const themedControls = [];
    const refreshControlAttributes = [];

    return {
      ImportDeclaration(node) {
        const named = node.specifiers
          .filter(specifier => specifier.type === 'ImportSpecifier')
          .map(specifier => specifier.imported.name);
        if (
          node.source.value === 'react-native' &&
          named.includes('RefreshControl')
        ) {
          importsRnRefreshControl = node;
        }
        if (
          node.source.value === 'react-native-gesture-handler' &&
          named.includes('ScrollView')
        ) {
          importsRnghScrollView = true;
        }
      },

      JSXOpeningElement(node) {
        const tag = tagName(node.name);
        if (tag === 'SwipeAwareScrollComponent') rendersSharedHost = true;
        if (tag === 'ThemedRefreshControl') themedControls.push(node);
        if (tag === 'FlashList') flashLists.push(node);
        const refresh = attribute(node, 'refreshControl');
        if (refresh) refreshControlAttributes.push(refresh);
      },

      'Program:exit'() {
        const rnghHostedLists = flashLists.filter(element => {
          const scroll = attribute(element, 'renderScrollComponent');
          return (
            scroll?.value?.type === 'JSXExpressionContainer' &&
            scroll.value.expression.type === 'Identifier' &&
            scroll.value.expression.name === 'SwipeAwareScrollComponent'
          );
        });
        const hasRnghHost =
          rnghHostedLists.length > 0 ||
          importsRnghScrollView ||
          rendersSharedHost;

        for (const element of rnghHostedLists) {
          if (!attribute(element, 'onRefresh')) continue;
          const refresh = attribute(element, 'refreshControl');
          if (!refresh) {
            context.report({ node: element, messageId: 'bareOnRefresh' });
          } else if (!rendersThemedControl(refresh)) {
            context.report({ node: refresh, messageId: 'wrongControl' });
          }
        }

        if (hasRnghHost && importsRnRefreshControl) {
          context.report({
            node: importsRnRefreshControl,
            messageId: 'rnImportWithRnghHost',
          });
        }

        if (!hasRnghHost) {
          for (const control of themedControls) {
            context.report({
              node: control,
              messageId: 'themedControlWithoutRnghHost',
            });
          }
        }

        // A raw RNGH scroller with pull-to-refresh, rather than the shared host.
        if (importsRnghScrollView && !rendersSharedHost) {
          for (const refresh of refreshControlAttributes) {
            context.report({
              node: refresh,
              messageId: 'handRolledRnghScroller',
            });
          }
        }
      },
    };
  },
};
