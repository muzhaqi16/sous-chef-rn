import { useAnimatedStyle, interpolate } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import type { ViewStyle } from 'react-native';
import { useDragState } from '../../contexts/DragStateContext';
import type { UseDragAnimatedStyleResult } from '../../types';

/**
 * Hook that creates animated styles for drag operations.
 *
 * Handles both dragged item and non-dragged item styles:
 * - Dragged item: Uses translateY for position + scale from context
 * - Non-dragged items: Uses shiftY for displacement animation
 *
 * CRITICAL: This hook merges transforms into a single style because React Native
 * doesn't merge transform arrays (when multiple styles have transforms, the last one wins).
 *
 * Also handles:
 * - zIndex elevation for dragged item
 * - Shadow opacity animation
 * - Elevation for Android
 *
 * @example
 * ```tsx
 * const { dragAnimatedStyle } = useDragAnimatedStyle(
 *   item.id,
 *   isDragging,
 *   translateY,
 *   shiftY
 * );
 *
 * <Animated.View style={[styles.container, isDragEnabled && dragAnimatedStyle]}>
 *   ...
 * </Animated.View>
 * ```
 */
export function useDragAnimatedStyle(
  itemId: string,
  isDragging: SharedValue<boolean>,
  translateY: SharedValue<number>,
  shiftY: SharedValue<number>,
): UseDragAnimatedStyleResult {
  // Global drag state for scale and identity check
  const { draggedItemId, draggedScale, config } = useDragState();

  // Animated style for drag offset with scale and shadow
  const dragAnimatedStyle = useAnimatedStyle(() => {
    const isThisItemDragged = draggedItemId.value === itemId;

    // Keep elevated if: actively dragging OR has offset (animating back)
    const shouldBeElevated =
      isDragging.value || Math.abs(translateY.value) > 1;

    const shadowOpacity = interpolate(
      draggedScale.value,
      [1, config.dragScale],
      [0.1, config.dragShadowOpacity],
    );

    // Use drag translateY for dragged item, shift translateY for non-dragged items
    const yOffset = isThisItemDragged ? translateY.value : shiftY.value;

    return {
      transform: [
        { translateY: yOffset },
        { scale: isThisItemDragged ? draggedScale.value : 1 },
      ],
      zIndex: shouldBeElevated ? 999 : 0,
      shadowOpacity: isThisItemDragged ? shadowOpacity : 0.1,
      elevation: isDragging.value ? 12 : 4,
    } as ViewStyle;
  });

  return { dragAnimatedStyle };
}
