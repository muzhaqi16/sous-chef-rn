/**
 * Drag-to-reorder hooks
 *
 * These hooks encapsulate the complex logic for implementing drag-to-reorder
 * functionality in a FlashList. They work together with DragStateContext
 * to coordinate animations across all items.
 *
 * Usage:
 * ```tsx
 * const { panGesture, isDragging, translateY } = useDragGesture(config, callbacks);
 * const { shiftY } = useDragShift({ itemId, index });
 * useDropCompensation({ itemId, index, translateY, shiftY });
 * const { dragAnimatedStyle } = useDragAnimatedStyle(itemId, isDragging, translateY, shiftY);
 * ```
 */

export { useDragGesture } from './useDragGesture';
export type {
  UseDragGestureConfig,
  UseDragGestureCallbacks,
  UseDragGestureResult,
} from './useDragGesture';

export { useDragShift } from './useDragShift';
export type { UseDragShiftConfig, UseDragShiftResult } from './useDragShift';

export { useDropCompensation } from './useDropCompensation';
export type { UseDropCompensationConfig } from './useDropCompensation';

export { useDragAnimatedStyle } from './useDragAnimatedStyle';
export type { UseDragAnimatedStyleResult } from './useDragAnimatedStyle';
