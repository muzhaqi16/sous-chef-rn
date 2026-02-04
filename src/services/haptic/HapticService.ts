import { Vibration, Platform } from 'react-native';
import { useStore } from '#store/index';

/**
 * Haptic Feedback Types
 *
 * Maps to different vibration patterns for various user interactions
 */
export enum HapticFeedbackType {
  /** Light tap - for selections, toggles */
  LIGHT = 'light',
  /** Medium impact - for button presses */
  MEDIUM = 'medium',
  /** Heavy impact - for significant actions */
  HEAVY = 'heavy',
  /** Success feedback - for completed actions */
  SUCCESS = 'success',
  /** Warning feedback - for caution states */
  WARNING = 'warning',
  /** Error feedback - for errors or failures */
  ERROR = 'error',
  /** Selection changed - for picker/selector changes */
  SELECTION = 'selection',
  /** Long press detected */
  LONG_PRESS = 'longPress',
}

/**
 * Vibration patterns (in milliseconds)
 * Format: [wait, vibrate, wait, vibrate, ...]
 *
 * Android guidelines recommend 10-20ms for crisp click feedback.
 * @see https://developer.android.com/develop/ui/views/haptics/haptics-principles
 */
const HAPTIC_PATTERNS: Record<HapticFeedbackType, number | number[]> = {
  [HapticFeedbackType.LIGHT]: 15, // Android recommends 10-20ms for crisp feedback
  [HapticFeedbackType.MEDIUM]: 20, // Upper end of recommended range
  [HapticFeedbackType.HEAVY]: 40, // Reduced from 50ms
  [HapticFeedbackType.SUCCESS]: [0, 12, 40, 12], // Two quick taps
  [HapticFeedbackType.WARNING]: [0, 18, 80, 18], // Two medium taps with pause
  [HapticFeedbackType.ERROR]: [0, 35, 80, 35, 80, 35], // Three strong taps
  [HapticFeedbackType.SELECTION]: 10, // Minimum perceptible
  [HapticFeedbackType.LONG_PRESS]: 80, // Reduced from 100ms
};

/**
 * Haptic Feedback Service
 *
 * Provides consistent haptic feedback across the app using React Native's
 * built-in Vibration API. Supports user preferences and graceful degradation.
 *
 * @example
 * ```typescript
 * // Trigger light haptic feedback
 * HapticService.trigger(HapticFeedbackType.LIGHT);
 *
 * // Trigger success feedback
 * HapticService.success();
 *
 * // Disable haptics
 * HapticService.setEnabled(false);
 * ```
 */
class HapticFeedbackService {
  private supported: boolean = true;

  constructor() {
    // Check if vibration is supported
    // Note: Vibration API is supported on iOS and Android by default in RN
    this.supported = Platform.OS === 'ios' || Platform.OS === 'android';
  }

  /**
   * Enable or disable haptic feedback
   * Updates the preference in the store
   */
  setEnabled(enabled: boolean): void {
    useStore.getState().setHapticFeedbackEnabled(enabled);
  }

  /**
   * Check if haptic feedback is currently enabled
   * Reads from the store preference
   */
  isEnabled(): boolean {
    const hapticEnabled = useStore.getState().hapticFeedbackEnabled;
    return (hapticEnabled ?? true) && this.supported;
  }

  /**
   * Check if haptic feedback is supported on this device
   */
  isSupported(): boolean {
    return this.supported;
  }

  /**
   * Trigger haptic feedback with specified type
   *
   * @param type - The type of haptic feedback to trigger
   */
  trigger(type: HapticFeedbackType): void {
    if (!this.isEnabled()) {
      return;
    }

    try {
      const pattern = HAPTIC_PATTERNS[type];

      if (typeof pattern === 'number') {
        // Single vibration
        Vibration.vibrate(pattern);
      } else {
        // Pattern vibration (Android supports patterns, iOS will use first value)
        Vibration.vibrate(pattern);
      }
    } catch (error) {
      // Silently fail if vibration is not available
      console.warn('[HapticService] Failed to trigger haptic feedback:', error);
    }
  }

  /**
   * Cancel any ongoing vibration
   */
  cancel(): void {
    try {
      Vibration.cancel();
    } catch (error) {
      console.warn('[HapticService] Failed to cancel vibration:', error);
    }
  }

  // Convenience methods for common feedback types

  /**
   * Light tap feedback - for selections, toggles
   */
  light(): void {
    this.trigger(HapticFeedbackType.LIGHT);
  }

  /**
   * Medium impact feedback - for button presses
   */
  medium(): void {
    this.trigger(HapticFeedbackType.MEDIUM);
  }

  /**
   * Heavy impact feedback - for significant actions
   */
  heavy(): void {
    this.trigger(HapticFeedbackType.HEAVY);
  }

  /**
   * Success feedback - for completed actions
   */
  success(): void {
    this.trigger(HapticFeedbackType.SUCCESS);
  }

  /**
   * Warning feedback - for caution states
   */
  warning(): void {
    this.trigger(HapticFeedbackType.WARNING);
  }

  /**
   * Error feedback - for errors or failures
   */
  error(): void {
    this.trigger(HapticFeedbackType.ERROR);
  }

  /**
   * Selection changed feedback - for picker/selector changes
   */
  selection(): void {
    this.trigger(HapticFeedbackType.SELECTION);
  }

  /**
   * Long press feedback
   */
  longPress(): void {
    this.trigger(HapticFeedbackType.LONG_PRESS);
  }
}

// Export singleton instance
export const HapticService = new HapticFeedbackService();

// Export type for convenience
export type { HapticFeedbackService };
