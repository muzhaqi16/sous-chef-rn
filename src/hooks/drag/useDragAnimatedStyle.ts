import { useAnimatedStyle, interpolate } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import type { ViewStyle } from 'react-native';
import { useDragState } from '#/components/organisms/SortableShoppingList/DragStateContext';
import { DRAG_SCALE, DRAG_SHADOW_OPACITY } from '#/constants/drag';

/**
 * Return value from useDragAnimatedStyle hook
 */
export interface UseDragAnimatedStyleResult {
  /** Animated style for the dragged item (transform, zIndex, shadow) */
  dragAnimatedStyle: ReturnType<typeof useAnimatedStyle>;
}

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
  const { draggedItemId, draggedScale } = useDragState();

  // Animated style for drag offset with scale and shadow
  // CRITICAL: This style handles BOTH dragged item positioning AND non-dragged item shifts
  // We must merge transforms into a single style because React Native doesn't merge transform arrays
  // (when multiple styles have transforms, the last one wins and overwrites the others)
  const dragAnimatedStyle = useAnimatedStyle(() => {
    // Use ID-based check for stable identity across FlashList recycling
    const isThisItemDragged = draggedItemId.value === itemId;

    // Keep elevated if: actively dragging OR has offset (animating back)
    const shouldBeElevated =
      isDragging.value || Math.abs(translateY.value) > 1;

    const shadowOpacity = interpolate(
      draggedScale.value,
      [1, DRAG_SCALE],
      [0.1, DRAG_SHADOW_OPACITY],
    );

    // CRITICAL FIX: Use drag translateY for dragged item, shift translateY for non-dragged items
    // This merges both transforms into one array to prevent override
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
