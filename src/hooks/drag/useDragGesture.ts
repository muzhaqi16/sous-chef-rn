import { useCallback, useRef, useMemo } from 'react';
import {
  useSharedValue,
  measure,
  withSpring,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import type { SharedValue, AnimatedRef } from 'react-native-reanimated';
import { Gesture } from 'react-native-gesture-handler';
import type { GestureType } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import Animated from 'react-native-reanimated';
import { useDragState } from '#/components/organisms/SortableShoppingList/DragStateContext';
import { HapticService } from '#/services/haptic';
import {
  DRAG_ITEM_HEIGHT,
  DRAG_SCALE,
  ITEM_VERTICAL_MARGIN,
  LONG_PRESS_DURATION,
  EDGE_THRESHOLD,
  MAX_SCROLL_SPEED,
} from '#/constants/drag';

/**
 * Configuration for useDragGesture hook
 */
export interface UseDragGestureConfig {
  /** Item ID for stable identity */
  itemId: string;
  /** Current index in list */
  index: number;
  /** Total number of items in the list */
  totalItems: number;
  /** Whether drag is enabled for this item */
  enabled: boolean;
  /** Ref to measure item container */
  containerRef: AnimatedRef<Animated.View>;
}

/**
 * Callbacks for drag gesture events
 */
export interface UseDragGestureCallbacks {
  /** Called when reorder should occur (with index delta) */
  onReorderByDelta?: (itemId: string, delta: number) => void;
}

/**
 * Return value from useDragGesture hook
 */
export interface UseDragGestureResult {
  /** The pan gesture to attach to drag handle */
  panGesture: GestureType;
  /** Whether this item is currently being dragged */
  isDragging: SharedValue<boolean>;
  /** Current translateY of this item */
  translateY: SharedValue<number>;
}

/**
 * Hook that encapsulates all drag gesture logic.
 *
 * Handles:
 * - Pan gesture with long press activation (200ms)
 * - Autoscroll when dragging near viewport edges
 * - Haptic feedback on drag start and drop
 * - Scale animation for visual feedback
 * - Drop position calculation based on drag offset
 *
 * Uses DragStateContext for global coordination across all items.
 *
 * @example
 * ```tsx
 * const { panGesture, isDragging, translateY } = useDragGesture(
 *   { itemId: item.id, index, totalItems, enabled: true, containerRef },
 *   { onReorderByDelta: handleReorder }
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
  const { onReorderByDelta } = callbacks;

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
  } = useDragState();

  // Store current values in refs for stable gesture callbacks
  // This prevents gesture recreation when these values change
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
  // Also handles animation and state reset based on whether position changed
  const handleDragEnd = useCallback(
    (finalTranslateY: number) => {
      const {
        index: currentIndex,
        totalItems: total,
        itemId: currentItemId,
        onReorderByDelta: reorder,
      } = dragContextRef.current;

      // Use dynamically measured height + margins, or fall back to constant (which already includes margins)
      const itemHeight =
        measuredItemHeight.value > 0
          ? measuredItemHeight.value + ITEM_VERTICAL_MARGIN
          : DRAG_ITEM_HEIGHT;

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
        // CASE 1: Position changes - call reorder, let useDropCompensation handle everything
        // Cache updates synchronously in handleSortOrderUpdate (cache.modify + cache.writeQuery)
        isDropping.value = true; // Freeze shift values during drop transition
        HapticService.medium();
        reorder(currentItemId, positionDelta);

        // Reset translate values (won't affect shifts since isDropping is true)
        // useDropCompensation will reset everything after the settle animation
        currentTranslateY.value = 0;
        dragStartScrollOffset.value = 0;
      } else {
        // CASE 2: Same position - just animate back and reset state
        translateY.value = withTiming(
          0,
          { duration: 150, easing: Easing.out(Easing.ease) },
          finished => {
            'worklet';
            if (finished) {
              // Reset all global state
              globalIsDragging.value = false;
              draggedIndex.value = -1;
              draggedItemId.value = '';
              currentTranslateY.value = 0;
              dragStartScrollOffset.value = 0;
              measuredItemHeight.value = 0;
              // PERFORMANCE: Direct increment without withTiming
              dragUpdateTrigger.value = dragUpdateTrigger.value + 1;
            }
          },
        );
      }
    },
    [
      measuredItemHeight,
      translateY,
      globalIsDragging,
      draggedIndex,
      draggedItemId,
      currentTranslateY,
      dragStartScrollOffset,
      dragUpdateTrigger,
      isDropping,
    ],
  );

  // Stable haptic callback for drag start - must be defined in RN Runtime scope
  // for scheduleOnRN to work correctly (cannot use arrow functions inside worklets)
  // @see https://docs.swmansion.com/react-native-worklets/docs/threading/scheduleOnRN/
  const triggerLightHaptic = useCallback(() => {
    HapticService.light();
  }, []);

  // Pan gesture for drag-to-reorder (attached to drag handle only)
  // Using drag handle avoids gesture conflicts with Swipeable and TouchableOpacity
  // activateAfterLongPress requires holding the drag handle to start dragging
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(LONG_PRESS_DURATION) // Require long press to start drag
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
          // Global drag state for shift animations (centralized)
          globalIsDragging.value = true;
          draggedIndex.value = index;
          draggedItemId.value = itemId; // Track by ID for stable identity
          dragStartScrollOffset.value = scrollOffset.value; // Remember scroll position at drag start
          currentTranslateY.value = 0;
          draggedScale.value = withSpring(DRAG_SCALE, {
            damping: 15,
            stiffness: 400,
          });
          // PERFORMANCE: Direct assignment + 1 to trigger useDerivedValue re-evaluation
          // Removed withTiming wrapper as it creates unnecessary micro-animations
          dragUpdateTrigger.value = dragUpdateTrigger.value + 1;
          // Pass function reference (not arrow function) - must be defined in RN Runtime scope
          scheduleOnRN(triggerLightHaptic);
        })
        .onUpdate(event => {
          'worklet';
          // Local drag state for this item's position
          translateY.value = event.translationY;
          // Global drag state for shift calculations
          currentTranslateY.value = event.translationY;
          // PERFORMANCE: Direct increment to trigger useDerivedValue re-evaluation
          // Removed withTiming wrapper as it creates unnecessary micro-animations (60+ per second)
          // The UI thread SharedValue assignment is sufficient to trigger reactive updates
          dragUpdateTrigger.value = dragUpdateTrigger.value + 1;

          // Autoscroll when dragging near edges of the FlashList viewport
          // Convert screen coordinates to list-relative coordinates
          const fingerInList = event.absoluteY - listTopY.value;
          const topEdge = EDGE_THRESHOLD;
          const bottomEdge = visibleHeight.value - EDGE_THRESHOLD;

          if (fingerInList < topEdge && scrollOffset.value > 0) {
            // Scroll up - finger is near top of list, faster closer to edge
            const speed = interpolate(
              fingerInList,
              [0, topEdge],
              [MAX_SCROLL_SPEED, 0],
              'clamp',
            );
            const newOffset = Math.max(0, scrollOffset.value - speed);
            scrollOffset.value = newOffset; // Update SharedValue for hover calculation
            scheduleOnRN(scrollToOffset, newOffset);
          } else if (fingerInList > bottomEdge) {
            // Scroll down - finger is near bottom of list
            const maxOffset = Math.max(
              0,
              contentHeight.value - visibleHeight.value,
            );
            if (scrollOffset.value < maxOffset) {
              const speed = interpolate(
                fingerInList,
                [bottomEdge, visibleHeight.value],
                [0, MAX_SCROLL_SPEED],
                'clamp',
              );
              const newOffset = Math.min(maxOffset, scrollOffset.value + speed);
              scrollOffset.value = newOffset; // Update SharedValue for hover calculation
              scheduleOnRN(scrollToOffset, newOffset);
            }
          }
        })
        .onEnd(event => {
          'worklet';
          // Local drag state
          isDragging.value = false;
          const finalY = event.translationY;

          // Scale back to normal
          draggedScale.value = withSpring(1, { damping: 15, stiffness: 400 });

          // Call reorder callback on JS thread - cache updates synchronously there
          // handleDragEnd will handle animation and state reset based on whether position changed
          scheduleOnRN(handleDragEnd, finalY);

          // DON'T animate translateY here - handleDragEnd/useDropCompensation handle it
          // DON'T reset global state here - handleDragEnd does it after cache update
        })
        .onFinalize((_event, success) => {
          'worklet';
          // onFinalize is called after EVERY gesture end (success or cancel)
          // Only do full reset if gesture was CANCELLED (success = false)
          // For successful gestures, onEnd already handled the state properly
          if (!success) {
            // Local drag state
            isDragging.value = false;
            translateY.value = withTiming(0, { duration: 150 });
            // Global drag state - full reset
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
    // SharedValue refs are stable (created once in context), so only include:
    // - enabled: controls gesture activation
    // - containerRef: needed for measuring
    // - triggerLightHaptic/handleDragEnd: callbacks called via scheduleOnRN
    // - index/itemId: captured in worklet for drag state identification
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, containerRef, triggerLightHaptic, handleDragEnd, index, itemId],
  );

  return { panGesture, isDragging, translateY };
}
