import React from 'react';
import { useTranslation } from '#/i18n';
import {
  View,
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
  type ViewStyle,
} from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { type SharedValue } from 'react-native-reanimated';
import { SwipeActions, swipeTrayWidth } from './SwipeActions';
import { SwipeableContent } from './SwipeableContent';
import { useSwipeableActions } from './hooks/useSwipeableActions';
import { styles } from './styles';
import type { SwipeAction, SwipeableItemProps } from './types';

// Matches marginLeft/marginRight: -12 in actionsContainer/leftActionsContainer styles.
// Placeholders must include the same margin so the Swipeable measures the same layout
// width as the actual action components — preventing the card from opening past the
// action background during the placeholder→actual component transition.
const CARD_EDGE_EXTENSION = 12;

// Defence in depth only: what actually keeps a scroll from opening rows is the list
// rendering RNGH's ScrollView (see SwipeAwareScrollComponent) — no activation
// distance can, because the v3 pan is never cancelled when the scroll takes over and
// so crosses any threshold eventually. 16dp is Android's own PAGING_TOUCH_SLOP for a
// horizontal gesture nested in a vertical scroller.
const DEFAULT_DRAG_OFFSET = 16;

// Reserves the tray's width before the real one mounts, so the card cannot open
// past its own action background during the placeholder→actual swap. The margin
// mirrors the -12 in the action container styles.
//
// Memoized per (count, side): the style object is a prop on a view that renders
// on every swipe frame, and a fresh object each time defeats the identity check
// downstream. The pair of frozen lookup tables this replaced did the same job;
// the cache keeps that property without enumerating the counts by hand.
const placeholderStyles = new Map<string, ViewStyle>();
const placeholderStyle = (count: number, side: 'left' | 'right'): ViewStyle => {
  const cacheKey = `${side}:${count}`;
  const cached = placeholderStyles.get(cacheKey);
  if (cached) return cached;

  const style: ViewStyle = {
    width: swipeTrayWidth(count),
    ...(side === 'left'
      ? { marginRight: -CARD_EDGE_EXTENSION }
      : { marginLeft: -CARD_EDGE_EXTENSION }),
  };
  placeholderStyles.set(cacheKey, style);
  return style;
};

/**
 * Module-level so an omitted action list keeps ONE identity for the life of the
 * app. `leftActions = []` as an inline default allocates a fresh array on every
 * render, and the React Compiler cannot cache anything derived from a value
 * that changes identity every time — which, for this component, is the action
 * list, the accessibility actions (one `t()` per action), the action handler
 * and both tray renderers. Rows are the most re-rendered surface in the app,
 * and most of them pass no actions at all.
 */
const EMPTY_ACTIONS: SwipeAction[] = [];

const SwipeableItemComponent: React.FC<SwipeableItemProps> = ({
  children,
  itemId,
  onPress,
  onLongPress,
  leftActions = EMPTY_ACTIONS,
  rightActions = EMPTY_ACTIONS,
  leftThreshold = 120,
  rightThreshold = 120,
  friction = 1.5,
  onSwipeableWillOpen,
  onSwipeableClose,
  testIDPrefix,
  enabled = true,
  dragOffset = DEFAULT_DRAG_OFFSET,
}) => {
  const { t } = useTranslation();
  // Fewer actions = smaller threshold, for a more natural swipe.
  const computedLeftThreshold = leftActions.length <= 1 ? 60 : leftThreshold;
  const computedRightThreshold = rightActions.length <= 1 ? 60 : rightThreshold;

  const {
    swipeableRef,
    handleSwipeableWillOpen,
    handleSwipeableClose,
    hasSwipeStarted,
    handleSwipeOpenStartDrag,
  } = useSwipeableActions({
    itemId,
    onSwipeableWillOpen,
    onSwipeableClose,
  });

  // Actions inherit the row's testID as a prefix unless they set their own, so
  // a pantry row's edit button stays `pantry-item-<id>-edit` without every call
  // site threading the prefix into every action it builds.
  const withTestIDs = (actions: SwipeAction[]): SwipeAction[] =>
    testIDPrefix
      ? actions.map(action =>
          action.testID
            ? action
            : { ...action, testID: `${testIDPrefix}-${action.key}` },
        )
      : actions;

  // Two named renderers rather than one curried builder: react-navigation calls
  // these per side, and a function produced during render reads to ESLint as an
  // inline component definition.
  const renderLeftTray = (progress: SharedValue<number>) =>
    !hasSwipeStarted ? (
      <View style={placeholderStyle(leftActions.length, 'left')} />
    ) : (
      <SwipeActions
        actions={withTestIDs(leftActions)}
        side="left"
        swipeableRef={swipeableRef}
        progress={progress}
      />
    );

  const renderRightTray = (progress: SharedValue<number>) =>
    !hasSwipeStarted ? (
      <View style={placeholderStyle(rightActions.length, 'right')} />
    ) : (
      <SwipeActions
        actions={withTestIDs(rightActions)}
        side="right"
        swipeableRef={swipeableRef}
        progress={progress}
      />
    );

  // Every swipe action is also an accessibility action, so VoiceOver/TalkBack
  // users can reach it without swiping. Derived from the same list rather than
  // a parallel one — the two used to be separate `if` chains, and an action
  // added to one could silently miss the other.
  const allActions = [...leftActions, ...rightActions];

  // `key` doubles as the accessibility action NAME, and dispatch is a `find` —
  // so the same key on both edges publishes duplicate `accessibilityActions`
  // and VoiceOver/TalkBack always reaches the left one, silently. `key` became
  // free-form when the named verbs were replaced by descriptors, which is what
  // made this reachable at all.
  if (__DEV__) {
    const seen = new Set<string>();
    const duplicate = allActions.find(action => {
      if (seen.has(action.key)) return true;
      seen.add(action.key);
      return false;
    });
    if (duplicate) {
      throw new Error(
        `SwipeableItem: duplicate action key "${duplicate.key}". Keys are accessibility action names and must be unique within a row.`,
      );
    }
  }

  const accessibilityActions: AccessibilityActionInfo[] = allActions.map(
    action => ({ name: action.key, label: t(action.labelKey) }),
  );

  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    allActions
      .find(action => action.key === event.nativeEvent.actionName)
      ?.onPress();
  };

  // No wrapper view: the accessibility actions live on SwipeableContent's own
  // container, and `swipeableContainer` already carries the `overflow: 'visible'`
  // the wrapper existed for. One fewer view per row on every list using this
  // molecule — the frame cost on device is Yoga layout and RenderThread draw
  // over the mounted view tree, so per-row view count is what matters.
  return (
    <Swipeable
      ref={swipeableRef}
      enabled={enabled}
      friction={friction}
      leftThreshold={computedLeftThreshold}
      rightThreshold={computedRightThreshold}
      renderLeftActions={leftActions.length > 0 ? renderLeftTray : undefined}
      renderRightActions={rightActions.length > 0 ? renderRightTray : undefined}
      onSwipeableWillOpen={handleSwipeableWillOpen}
      onSwipeableClose={handleSwipeableClose}
      onSwipeableOpenStartDrag={handleSwipeOpenStartDrag}
      dragOffsetFromLeft={dragOffset}
      dragOffsetFromRight={-dragOffset}
      overshootFriction={8}
      overshootRight={false}
      overshootLeft={false}
      containerStyle={styles.swipeableContainer}
      childrenContainerStyle={styles.childrenContainer}
    >
      <SwipeableContent
        testID={testIDPrefix}
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityActions={accessibilityActions}
        onAccessibilityAction={handleAccessibilityAction}
      >
        {children}
      </SwipeableContent>
    </Swipeable>
  );
};

export const SwipeableItem = SwipeableItemComponent;
