import type { SharedValue, AnimatedRef } from 'react-native-reanimated';
import type { GestureType } from 'react-native-gesture-handler';
import type Animated from 'react-native-reanimated';

/**
 * Configuration for drag behavior
 */
export interface DragConfig {
  /** Fixed height for list items (used for drag calculations) */
  itemHeight: number;
  /** Scale factor applied to dragged item */
  dragScale: number;
  /** Shadow opacity for dragged item */
  dragShadowOpacity: number;
  /** Vertical margin per item */
  itemVerticalMargin: number;
  /** Duration (ms) to hold drag handle before drag activates */
  longPressDuration: number;
  /** Pixels from viewport edge to trigger autoscroll */
  edgeThreshold: number;
  /** Maximum scroll speed in pixels per frame */
  maxScrollSpeed: number;
}

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
  /** Optional haptic feedback callback */
  onHapticFeedback?: (type: 'light' | 'medium') => void;
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
 * Configuration for useDragShift hook
 */
export interface UseDragShiftConfig {
  /** Item ID for identity check (to skip shift for the dragged item) */
  itemId: string;
  /** Current index in list */
  index: number;
}

/**
 * Return value from useDragShift hook
 */
export interface UseDragShiftResult {
  /** Animated shift value for non-dragged items */
  shiftY: SharedValue<number>;
}

/**
 * Configuration for useDropCompensation hook
 */
export interface UseDropCompensationConfig {
  /** Item ID for stable identity check */
  itemId: string;
  /** Current index in list */
  index: number;
  /** This item's translateY SharedValue (from useDragGesture) */
  translateY: SharedValue<number>;
  /** This item's shiftY SharedValue (from useDragShift) */
  shiftY: SharedValue<number>;
}

/**
 * Return value from useDragAnimatedStyle hook
 */
export interface UseDragAnimatedStyleResult {
  /** Animated style for the dragged item (transform, zIndex, shadow) */
  dragAnimatedStyle: ReturnType<typeof import('react-native-reanimated').useAnimatedStyle>;
}
