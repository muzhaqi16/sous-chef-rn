import React, { useLayoutEffect, useMemo, useCallback } from 'react';
import Animated, { useAnimatedRef } from 'react-native-reanimated';
import type { ViewStyle } from 'react-native';
import {
  useDragGesture,
  useDragShift,
  useDragAnimatedStyle,
  useDropCompensation,
  useListExitAnimation,
  useListEntryAnimation,
} from './hooks';
import { useListAnimationOptional } from './contexts';
import type {
  AnimatedListItem,
  AnimatedRenderItemInfo,
  HapticFeedbackType,
} from './types';

interface AnimatedFlashListItemProps<T extends AnimatedListItem> {
  /** The item data */
  item: T;
  /** Current index in list */
  index: number;
  /** Total number of items */
  totalItems: number;
  /** Whether drag is enabled for this item */
  isDragEnabled: boolean;
  /** Render function from parent */
  renderItem: (info: AnimatedRenderItemInfo<T>) => React.ReactElement;
  /** Callback when reorder occurs */
  onReorderByDelta?: (itemId: string, delta: number) => void;
  /** Optional haptic feedback callback */
  onHapticFeedback?: (type: HapticFeedbackType) => void;
}

/**
 * Internal item wrapper that provides all animation functionality.
 *
 * This component:
 * 1. Sets up drag gesture and shift animations
 * 2. Sets up entry/exit animations
 * 3. Combines all animated styles
 * 4. Passes everything to the consumer's renderItem function
 *
 * @internal
 */
function AnimatedFlashListItemInner<T extends AnimatedListItem>({
  item,
  index,
  totalItems,
  isDragEnabled,
  renderItem,
  onReorderByDelta,
  onHapticFeedback,
}: AnimatedFlashListItemProps<T>): React.ReactElement | null {
  // Animated ref for measuring item height on drag start
  const containerRef = useAnimatedRef<Animated.View>();

  // === DRAG HOOKS ===

  // Pan gesture for drag-to-reorder
  const { panGesture, isDragging, translateY } = useDragGesture(
    {
      itemId: item.id,
      index,
      totalItems,
      enabled: isDragEnabled,
      containerRef,
    },
    {
      onReorderByDelta,
      onHapticFeedback,
    },
  );

  // Shift animation for non-dragged items
  const { shiftY } = useDragShift({ itemId: item.id, index });

  // Handle index changes after cache updates (drop compensation)
  useDropCompensation({ itemId: item.id, index, translateY, shiftY });

  // Animated style for drag transforms
  const { dragAnimatedStyle } = useDragAnimatedStyle(
    item.id,
    isDragging,
    translateY,
    shiftY,
  );

  // === ANIMATION HOOKS ===

  // Exit animation for smooth slide-out
  const { exitAnimatedStyle, triggerExit, resetAnimation } =
    useListExitAnimation(item.id);

  // Entry animation for items appearing
  const { entryAnimatedStyle } = useListEntryAnimation(item.id);

  // List animation context for subscription-triggered animations
  const animationContext = useListAnimationOptional();

  // Register exit animation trigger (O(1) direct calls from subscriptions)
  useLayoutEffect(() => {
    if (!animationContext) return;
    animationContext.registerAnimationTrigger(item.id, triggerExit);
    return () => animationContext.unregisterAnimationTrigger(item.id);
  }, [item.id, triggerExit, animationContext]);

  // Create combined animated style
  const combinedAnimatedStyle = useMemo<ViewStyle>(() => {
    // We can't directly combine animated styles here since they're worklet-based
    // Instead, we'll let the consumer apply them via the render prop
    return {};
  }, []);

  // Create drag handle props
  const dragHandleProps = useMemo(
    () =>
      isDragEnabled
        ? {
            gesture: panGesture,
            isDragging,
          }
        : null,
    [isDragEnabled, panGesture, isDragging],
  );

  // Trigger exit animation wrapper
  const triggerExitAnimation = useCallback(
    (
      direction: 1 | -1,
      onComplete: () => void,
      preset?: 'default' | 'fast',
    ) => {
      triggerExit(direction, onComplete, preset);
    },
    [triggerExit],
  );

  // Create render info
  const renderInfo = useMemo<AnimatedRenderItemInfo<T>>(
    () => ({
      item,
      index,
      totalItems,
      animatedStyle: combinedAnimatedStyle,
      dragHandleProps,
      isDragging: false, // This is a SharedValue, consumer should use dragHandleProps.isDragging
      isDragEnabled,
      triggerExitAnimation,
      resetExitAnimation: resetAnimation,
    }),
    [
      item,
      index,
      totalItems,
      combinedAnimatedStyle,
      dragHandleProps,
      isDragEnabled,
      triggerExitAnimation,
      resetAnimation,
    ],
  );

  // Render the item with animations applied
  // The consumer's renderItem gets wrapped in our animated container
  const renderedItem = renderItem(renderInfo);

  return (
    <Animated.View
      ref={containerRef}
      style={[
        exitAnimatedStyle,
        entryAnimatedStyle,
        isDragEnabled && dragAnimatedStyle,
      ]}
    >
      {renderedItem}
    </Animated.View>
  );
}

// Memoize to prevent unnecessary re-renders
export const AnimatedFlashListItem = React.memo(
  AnimatedFlashListItemInner,
) as typeof AnimatedFlashListItemInner;
