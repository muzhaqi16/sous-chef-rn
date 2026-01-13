import { useCallback, useRef, useMemo } from 'react';
import {
  useSharedValue,
  measure,
  withSpring,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { Gesture } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { useDragState } from '../../contexts/DragStateContext';
import type {
  UseDragGestureConfig,
  UseDragGestureCallbacks,
  UseDragGestureResult,
} from '../../types';

/**
 * Hook that encapsulates all drag gesture logic.
 *
 * Handles:
 * - Pan gesture with long press activation
 * - Autoscroll when dragging near viewport edges
 * - Optional haptic feedback on drag start and drop
 * - Scale animation for visual feedback
 * - Drop position calculation based on drag offset
 *
 * Uses DragStateContext for global coordination across all items.
 *
 * @example
 * ```tsx
 * const { panGesture, isDragging, translateY } = useDragGesture(
 *   { itemId: item.id, index, totalItems, enabled: true, containerRef },
 *   { onReorderByDelta: handleReorder, onHapticFeedback: triggerHaptic }
 * );
 *
 * // Attach to drag handle
 * <GestureDetector gesture={panGesture}>
 *   <Animated.View>
 *     <DragHandleIcon />
 *   </Animated.View>
 * </GestureDetector>
 * ```
 */
export function useDragGesture(
  config: UseDragGestureConfig,
  callbacks: UseDragGestureCallbacks,
): UseDragGestureResult {
  const { itemId, index, totalItems, enabled, containerRef } = config;
  const { onReorderByDelta, onHapticFeedback } = callbacks;

  // Local drag state for this item's animation
  const isDragging = useSharedValue(false);
  const translateY = useSharedValue(0);

  // Global drag state for coordinating animations across all items
  const {
    isDragging: globalIsDragging,
    draggedIndex,
    draggedItemId,
    currentTranslateY,
    draggedScale,
    scrollOffset,
    dragStartScrollOffset,
    contentHeight,
    visibleHeight,
    listTopY,
    dragUpdateTrigger,
    measuredItemHeight,
    isDropping,
    scrollToOffset,
    config: dragConfig,
  } = useDragState();

  // Store current values in refs for stable gesture callbacks
  const dragContextRef = useRef({
    index,
    totalItems,
    itemId,
    onReorderByDelta,
  });

  // Keep ref in sync with current values
  dragContextRef.current = {
    index,
    totalItems,
    itemId,
    onReorderByDelta,
  };

  // Calculate new position and call reorder callback
  const handleDragEnd = useCallback(
    (finalTranslateY: number) => {
      const {
        index: currentIndex,
        totalItems: total,
        itemId: currentItemId,
        onReorderByDelta: reorder,
      } = dragContextRef.current;

      // Use dynamically measured height + margins, or fall back to config
      const itemHeight =
        measuredItemHeight.value > 0
          ? measuredItemHeight.value + dragConfig.itemVerticalMargin
          : dragConfig.itemHeight;

      // Calculate how many positions to move based on drag offset
      const positionDelta = Math.round(finalTranslateY / itemHeight);

      // Calculate if position actually changes
      const newIndex = Math.max(
        0,
        Math.min(total - 1, currentIndex + positionDelta),
      );
      const positionChanged =
        reorder && positionDelta !== 0 && newIndex !== currentIndex;

      if (positionChanged) {
        // Position changes - call reorder, let useDropCompensation handle animation
        isDropping.value = true;
        onHapticFeedback?.('medium');
        reorder(currentItemId, positionDelta);

        // Reset translate values
        currentTranslateY.value = 0;
        dragStartScrollOffset.value = 0;
      } else {
        // Same position - animate back and reset state
        translateY.value = withTiming(
          0,
          { duration: 150, easing: Easing.out(Easing.ease) },
          finished => {
            'worklet';
            if (finished) {
              globalIsDragging.value = false;
              draggedIndex.value = -1;
              draggedItemId.value = '';
              currentTranslateY.value = 0;
              dragStartScrollOffset.value = 0;
              measuredItemHeight.value = 0;
              dragUpdateTrigger.value = dragUpdateTrigger.value + 1;
            }
          },
        );
      }
    },
    [
      measuredItemHeight,
      dragConfig,
      translateY,
      globalIsDragging,
      draggedIndex,
      draggedItemId,
      currentTranslateY,
      dragStartScrollOffset,
      dragUpdateTrigger,
      isDropping,
      onHapticFeedback,
    ],
  );

  // Stable haptic callback for drag start
  const triggerLightHaptic = useCallback(() => {
    onHapticFeedback?.('light');
  }, [onHapticFeedback]);

  // Pan gesture for drag-to-reorder
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(dragConfig.longPressDuration)
        .enabled(enabled)
        .onStart(() => {
          'worklet';
          // Measure actual item height for accurate drag calculations
          const measured = measure(containerRef);
          if (measured) {
            measuredItemHeight.value = measured.height;
          }

          // Local drag state
          isDragging.value = true;
          // Global drag state for shift animations
          globalIsDragging.value = true;
          draggedIndex.value = index;
          draggedItemId.value = itemId;
          dragStartScrollOffset.value = scrollOffset.value;
          currentTranslateY.value = 0;
          draggedScale.value = withSpring(dragConfig.dragScale, {
            damping: 15,
            stiffness: 400,
          });
          dragUpdateTrigger.value = dragUpdateTrigger.value + 1;
          scheduleOnRN(triggerLightHaptic);
        })
        .onUpdate(event => {
          'worklet';
          translateY.value = event.translationY;
          currentTranslateY.value = event.translationY;
          dragUpdateTrigger.value = dragUpdateTrigger.value + 1;

          // Autoscroll when dragging near edges
          const fingerInList = event.absoluteY - listTopY.value;
          const topEdge = dragConfig.edgeThreshold;
          const bottomEdge = visibleHeight.value - dragConfig.edgeThreshold;

          if (fingerInList < topEdge && scrollOffset.value > 0) {
            const speed = interpolate(
              fingerInList,
              [0, topEdge],
              [dragConfig.maxScrollSpeed, 0],
              'clamp',
            );
            const newOffset = Math.max(0, scrollOffset.value - speed);
            scrollOffset.value = newOffset;
            scheduleOnRN(scrollToOffset, newOffset);
          } else if (fingerInList > bottomEdge) {
            const maxOffset = Math.max(
              0,
              contentHeight.value - visibleHeight.value,
            );
            if (scrollOffset.value < maxOffset) {
              const speed = interpolate(
                fingerInList,
                [bottomEdge, visibleHeight.value],
                [0, dragConfig.maxScrollSpeed],
                'clamp',
              );
              const newOffset = Math.min(maxOffset, scrollOffset.value + speed);
              scrollOffset.value = newOffset;
              scheduleOnRN(scrollToOffset, newOffset);
            }
          }
        })
        .onEnd(event => {
          'worklet';
          isDragging.value = false;
          const finalY = event.translationY;

          draggedScale.value = withSpring(1, { damping: 15, stiffness: 400 });
          scheduleOnRN(handleDragEnd, finalY);
        })
        .onFinalize((_event, success) => {
          'worklet';
          if (!success) {
            isDragging.value = false;
            translateY.value = withTiming(0, { duration: 150 });
            isDropping.value = false;
            globalIsDragging.value = false;
            draggedIndex.value = -1;
            draggedItemId.value = '';
            currentTranslateY.value = 0;
            draggedScale.value = 1;
            dragStartScrollOffset.value = 0;
            measuredItemHeight.value = 0;
          }
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, containerRef, triggerLightHaptic, handleDragEnd, index, itemId],
  );

  return { panGesture, isDragging, translateY };
}
