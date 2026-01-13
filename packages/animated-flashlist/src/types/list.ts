import type { ReactElement, ComponentType, JSXElementConstructor } from 'react';
import type { ViewStyle } from 'react-native';
import type { FlashListProps } from '@shopify/flash-list';
import type { SharedValue } from 'react-native-reanimated';
import type { GestureType } from 'react-native-gesture-handler';
import type { DragConfig } from './drag';
import type {
  AnimationDirection,
  ExitAnimationPreset,
  ExitAnimationConfig,
  EntryAnimationConfig,
  HapticFeedbackType,
} from './animations';

/**
 * Base item interface - consumers extend this
 */
export interface AnimatedListItem {
  id: string;
}

/**
 * Props passed to drag handle wrapper
 */
export interface DragHandleProps {
  /** The pan gesture to attach */
  gesture: GestureType;
  /** Whether dragging is currently active */
  isDragging: SharedValue<boolean>;
}

/**
 * Render item info passed to renderItem callback
 */
export interface AnimatedRenderItemInfo<T extends AnimatedListItem> {
  /** The item data */
  item: T;
  /** Current index in list */
  index: number;
  /** Total number of items */
  totalItems: number;
  /** Combined animated style (drag + entry/exit) - apply to outer Animated.View */
  animatedStyle: ViewStyle;
  /** Drag handle props - spread onto GestureDetector wrapping your drag handle */
  dragHandleProps: DragHandleProps | null;
  /** Whether this item is currently being dragged */
  isDragging: boolean;
  /** Whether drag is enabled for this item */
  isDragEnabled: boolean;
  /** Trigger exit animation programmatically */
  triggerExitAnimation: (
    direction: AnimationDirection,
    onComplete: () => void,
    preset?: ExitAnimationPreset,
  ) => void;
  /** Reset exit animation state */
  resetExitAnimation: () => void;
}

/**
 * Configuration for the AnimatedFlashList
 */
export interface AnimatedFlashListConfig {
  /** Drag behavior configuration */
  drag?: Partial<DragConfig>;
  /** Exit animation configuration */
  exitAnimation?: Partial<ExitAnimationConfig>;
  /** Entry animation configuration */
  entryAnimation?: Partial<EntryAnimationConfig>;
}

/**
 * Props for AnimatedFlashList component
 */
export interface AnimatedFlashListProps<T extends AnimatedListItem>
  extends Omit<
    FlashListProps<T>,
    'data' | 'renderItem' | 'keyExtractor' | 'ref'
  > {
  /** List data */
  data: T[];

  /** Key extractor function */
  keyExtractor: (item: T, index: number) => string;

  /**
   * Render function for each item
   * Receives item data and animation utilities
   */
  renderItem: (info: AnimatedRenderItemInfo<T>) => ReactElement;

  /**
   * Whether drag-to-reorder is enabled
   * @default false
   */
  dragEnabled?: boolean;

  /**
   * Callback when an item is reordered
   * @param itemId - ID of the moved item
   * @param fromIndex - Original index
   * @param toIndex - New index
   */
  onReorder?: (itemId: string, fromIndex: number, toIndex: number) => void;

  /**
   * Callback with neighbor-based reorder info (for fractional indexing)
   * @param itemId - ID of the moved item
   * @param afterItemId - ID of item that should come before (null if moving to start)
   * @param beforeItemId - ID of item that should come after (null if moving to end)
   */
  onReorderByNeighbors?: (
    itemId: string,
    afterItemId: string | null,
    beforeItemId: string | null,
  ) => void;

  /**
   * Function to determine if an item can be dragged
   * @default () => true when dragEnabled is true
   */
  canDrag?: (item: T, index: number) => boolean;

  /**
   * Optional haptic feedback callback
   * Called during drag operations
   */
  onHapticFeedback?: (type: HapticFeedbackType) => void;

  /**
   * Configuration overrides
   */
  config?: AnimatedFlashListConfig;

  /**
   * Called when FlashList needs to prepare for layout animation
   * (before items are added/removed)
   */
  onPrepareLayoutAnimation?: () => void;

  /** Footer component */
  ListFooterComponent?:
    | ReactElement<unknown, string | JSXElementConstructor<unknown>>
    | ComponentType<unknown>
    | null;

  /** Refresh callback */
  onRefresh?: () => void | Promise<void>;

  /** Whether currently refreshing */
  refreshing?: boolean;

  /** Pagination callback */
  onEndReached?: () => void;

  /** Pagination threshold */
  onEndReachedThreshold?: number;
}

/**
 * Ref handle for AnimatedFlashList
 */
export interface AnimatedFlashListRef {
  /**
   * Prepare FlashList for layout animation before items are removed/added
   */
  prepareForLayoutAnimation: () => void;

  /**
   * Scroll to a specific offset
   */
  scrollToOffset: (offset: number, animated?: boolean) => void;

  /**
   * Scroll to a specific index
   */
  scrollToIndex: (index: number, animated?: boolean) => void;
}
