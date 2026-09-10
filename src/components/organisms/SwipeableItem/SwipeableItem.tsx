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
import {
  SwipeActions,
  swipeTrayWidth,
} from '#components/organisms/SwipeableItem/SwipeActions';
import { SwipeableContent } from '#components/organisms/SwipeableItem/SwipeableContent';
import { useSwipeableActions } from '#components/organisms/SwipeableItem/hooks/useSwipeableActions';
import { styles } from '#components/organisms/SwipeableItem/styles';
import type {
  SwipeAction,
  SwipeableItemProps,
} from '#components/organisms/SwipeableItem/types';

// Mirrors the -12 marginLeft/Right in the action container styles, so the
// placeholder measures the same width as the real tray and the card cannot open
// past its own action background during the swap.
const CARD_EDGE_EXTENSION = 12;

// Defence in depth only — the list rendering RNGH's ScrollView (see
// SwipeAwareScrollComponent) is what actually stops a scroll opening rows; no
// activation distance can. 16dp is Android's own PAGING_TOUCH_SLOP.
const DEFAULT_DRAG_OFFSET = 16;

// Reserves the tray's width before the real one mounts. Memoized per (count,
// side): this style is a prop on a view that renders every swipe frame, and a
// fresh object each time defeats the identity check downstream.
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
 * Module-level so an omitted action list keeps ONE identity for the app's life.
 * An inline `= []` default allocates per render, and the React Compiler can cache
 * nothing derived from it — here that is the action list, the accessibility
 * actions, the handler and both tray renderers, on the app's hottest surface.
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

  // Actions inherit the row's testID as a prefix unless they set their own.
  const withTestIDs = (actions: SwipeAction[]): SwipeAction[] =>
    testIDPrefix
      ? actions.map(action =>
          action.testID
            ? action
            : { ...action, testID: `${testIDPrefix}-${action.key}` },
        )
      : actions;

  // Two named renderers, not one curried builder: a function produced during
  // render reads to ESLint as an inline component definition.
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

  // Every swipe action is also an accessibility action, derived from the same
  // list so the two cannot drift.
  const allActions = [...leftActions, ...rightActions];

  // `key` doubles as the accessibility action NAME and dispatch is a `find`, so a
  // key repeated on both edges silently makes only the left one reachable.
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

  // No wrapper view: the accessibility actions sit on SwipeableContent's own
  // container and `swipeableContainer` already carries `overflow: 'visible'`.
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
