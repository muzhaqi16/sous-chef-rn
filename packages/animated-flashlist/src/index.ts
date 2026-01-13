/**
 * @sous-chef/animated-flashlist
 *
 * A high-performance animated FlashList with drag-to-reorder and entry/exit animations.
 *
 * @example
 * ```tsx
 * import {
 *   AnimatedFlashList,
 *   type AnimatedListItem,
 * } from '@sous-chef/animated-flashlist';
 *
 * interface MyItem extends AnimatedListItem {
 *   title: string;
 * }
 *
 * <AnimatedFlashList<MyItem>
 *   data={items}
 *   keyExtractor={(item) => item.id}
 *   renderItem={({ item, dragHandleProps, triggerExitAnimation }) => (
 *     <View>
 *       <Text>{item.title}</Text>
 *       {dragHandleProps && (
 *         <GestureDetector gesture={dragHandleProps.gesture}>
 *           <DragIcon />
 *         </GestureDetector>
 *       )}
 *     </View>
 *   )}
 *   dragEnabled
 *   onReorder={(itemId, from, to) => handleReorder(itemId, from, to)}
 * />
 * ```
 */

// Main component
export { AnimatedFlashList } from './AnimatedFlashList';
export { AnimatedFlashListItem } from './AnimatedFlashListItem';

// Contexts (for advanced usage)
export {
  DragStateProvider,
  useDragState,
  ListAnimationProvider,
  useListAnimation,
  useListAnimationOptional,
} from './contexts';

// Hooks (for advanced/custom implementations)
export {
  // Drag hooks
  useDragGesture,
  useDragShift,
  useDragAnimatedStyle,
  useDropCompensation,
  // Animation hooks
  useListExitAnimation,
  useListEntryAnimation,
} from './hooks';

// Constants (for customization)
export {
  DEFAULT_DRAG_CONFIG,
  createDragConfig,
  DEFAULT_EXIT_ANIMATION,
  FAST_EXIT_ANIMATION,
  DEFAULT_ENTRY_ANIMATION,
  getExitAnimationConfig,
  createEntryAnimationConfig,
  standardEasing,
} from './constants';

// Types
export type {
  // List types
  AnimatedListItem,
  AnimatedFlashListProps,
  AnimatedFlashListRef,
  AnimatedFlashListConfig,
  AnimatedRenderItemInfo,
  DragHandleProps,
  // Drag types
  DragConfig,
  UseDragGestureConfig,
  UseDragGestureCallbacks,
  UseDragGestureResult,
  UseDragShiftConfig,
  UseDragShiftResult,
  UseDropCompensationConfig,
  UseDragAnimatedStyleResult,
  // Animation types
  AnimationDirection,
  ExitAnimationPreset,
  ExitAnimationConfig,
  EntryAnimationConfig,
  PendingEntryAnimation,
  ExitAnimationTrigger,
  HapticFeedbackType,
} from './types';

// Context types
export type {
  DragStateContextValue,
  ListAnimationContextValue,
} from './contexts';
