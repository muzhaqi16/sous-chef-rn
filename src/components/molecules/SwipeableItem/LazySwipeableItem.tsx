import React, { useState, useCallback, useRef } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { SwipeableItem } from './index';
import { SwipeableItemProps } from './types';

/**
 * LazySwipeableItem - Performance-optimized wrapper for SwipeableItem
 *
 * PERFORMANCE: This component dramatically reduces initial render time by deferring
 * the expensive ReanimatedSwipeable setup until the user actually interacts with the item.
 *
 * Initial render: Simple TouchableOpacity (no shared values, no gesture handlers)
 * After first touch: Full SwipeableItem with all swipe functionality
 *
 * This reduces per-item Reanimated overhead from:
 * - 2+ useSharedValue calls
 * - 2+ useAnimatedStyle calls
 * - ReanimatedSwipeable internal setup
 * - Multiple Gesture.Tap() handlers in ActionButtons
 *
 * To: Zero Reanimated calls on initial render
 *
 * The swipeable functionality is "activated" on first touch and stays active
 * for the lifetime of the component.
 *
 * First tap behavior:
 * - onPressIn activates the swipeable (schedules re-render)
 * - onPress still fires and executes the action
 * - Re-render happens after touch completes, showing full SwipeableItem
 */
export const LazySwipeableItem: React.FC<SwipeableItemProps> = React.memo(
  ({
    children,
    onPress,
    onLongPress,
    testIDPrefix,
    ...swipeableProps
  }) => {
    // Track whether the full swipeable has been activated
    const [isActivated, setIsActivated] = useState(false);
    // Use ref to avoid recreating callback when isActivated changes
    const isActivatedRef = useRef(false);

    // Activate the full swipeable on first touch
    // Defer state update to next tick so onPress can fire first (for taps)
    // Swipes won't trigger onPress, so they just activate the swipeable
    const handlePressIn = useCallback(() => {
      if (!isActivatedRef.current) {
        isActivatedRef.current = true;
        // Defer to allow onPress to fire before re-render
        setTimeout(() => setIsActivated(true), 0);
      }
    }, []);

    // Before activation: render lightweight touchable
    // First tap: handlePressIn activates AND executes onPress
    if (!isActivated) {
      return (
        <View
          style={styles.container}
          testID={testIDPrefix ? `${testIDPrefix}-container` : undefined}
        >
          <TouchableOpacity
            onPressIn={handlePressIn}
            onPress={onPress}
            onLongPress={onLongPress}
            // 150ms is faster than RN default (500ms) for more responsive long press
            // Unrelated to useDeferredRender's 150ms delay (different purpose)
            delayLongPress={150}
            activeOpacity={1}
            style={styles.touchable}
            testID={testIDPrefix ? `${testIDPrefix}-touchable` : undefined}
          >
            {children}
          </TouchableOpacity>
        </View>
      );
    }

    // After activation: render full SwipeableItem with all features
    return (
      <SwipeableItem
        onPress={onPress}
        onLongPress={onLongPress}
        testIDPrefix={testIDPrefix}
        {...swipeableProps}
      >
        {children}
      </SwipeableItem>
    );
  },
);

LazySwipeableItem.displayName = 'LazySwipeableItem';

const styles = StyleSheet.create(() => ({
  container: {
    overflow: 'hidden',
  },
  touchable: {
    // Match the styling of SwipeableContent
  },
}));
