/**
 * Animation direction for entry/exit animations
 * 1 = forward/right, -1 = backward/left
 */
export type AnimationDirection = 1 | -1;

/**
 * Animation preset type for exit animations
 * - 'default': Standard exit animation (for swipe/delete actions)
 * - 'fast': Quick exit animation (for checkbox toggles)
 */
export type ExitAnimationPreset = 'default' | 'fast';

/**
 * Haptic feedback types that can be triggered during animations
 */
export type HapticFeedbackType = 'light' | 'medium' | 'heavy' | 'selection';

/**
 * Configuration for exit animations
 */
export interface ExitAnimationConfig {
  slide: {
    duration: number;
    distance: number;
  };
  fade: {
    delay: number;
    duration: number;
  };
  scale: {
    delay: number;
    duration: number;
    toValue: number;
  };
  removalDelay: number;
  layoutAnimation: {
    duration: number;
  };
}

/**
 * Configuration for entry animations
 */
export interface EntryAnimationConfig {
  fade: { duration: number };
  slide: { distance: number; duration: number };
}

/**
 * Pending entry animation info
 */
export interface PendingEntryAnimation {
  itemId: string;
  direction: AnimationDirection;
  timestamp: number;
}

/**
 * Exit animation trigger function type
 */
export type ExitAnimationTrigger = (
  direction: AnimationDirection,
  onComplete: () => void,
  preset?: ExitAnimationPreset,
) => void;
