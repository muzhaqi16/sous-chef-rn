import { Platform } from 'react-native';
import {
  trigger as triggerHaptic,
  HapticFeedbackTypes,
} from 'react-native-haptic-feedback';
import { useStore } from '#store';
import { logger } from '#/utils/environment';

/**
 * Haptic Feedback Types
 *
 * Mapped to react-native-haptic-feedback's native iOS Haptic Feedback
 * Generator and Android equivalents. iOS produces real haptics (not just
 * vibrations); Android falls back to vibration patterns when the device
 * has no haptic actuator.
 */
export enum HapticFeedbackType {
  LIGHT = 'light',
  MEDIUM = 'medium',
  HEAVY = 'heavy',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
  SELECTION = 'selection',
  LONG_PRESS = 'longPress',
}

const NATIVE_TYPE: Record<HapticFeedbackType, HapticFeedbackTypes> = {
  [HapticFeedbackType.LIGHT]: HapticFeedbackTypes.impactLight,
  [HapticFeedbackType.MEDIUM]: HapticFeedbackTypes.impactMedium,
  [HapticFeedbackType.HEAVY]: HapticFeedbackTypes.impactHeavy,
  [HapticFeedbackType.SUCCESS]: HapticFeedbackTypes.notificationSuccess,
  [HapticFeedbackType.WARNING]: HapticFeedbackTypes.notificationWarning,
  [HapticFeedbackType.ERROR]: HapticFeedbackTypes.notificationError,
  [HapticFeedbackType.SELECTION]: HapticFeedbackTypes.selection,
  [HapticFeedbackType.LONG_PRESS]: HapticFeedbackTypes.longPress,
};

const TRIGGER_OPTIONS = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

class HapticFeedbackService {
  private supported = Platform.OS === 'ios' || Platform.OS === 'android';
  private initialized = false;
  private enabledPreference: boolean | undefined;
  private unsubscribe: (() => void) | undefined;

  /**
   * Cache the user preference and subscribe to future changes. Call once
   * after store hydration in App.tsx.
   */
  initialize(): void {
    if (this.initialized) return;
    this.enabledPreference = useStore.getState().hapticFeedbackEnabled ?? true;
    this.initialized = true;
    this.unsubscribe = useStore.subscribe(
      state => state.hapticFeedbackEnabled,
      enabled => {
        this.enabledPreference = enabled ?? true;
      },
    );
  }

  setEnabled(enabled: boolean): void {
    useStore.getState().setHapticFeedbackEnabled(enabled);
  }

  isEnabled(): boolean {
    // `initialize()` is deliberately deferred to the idle queue in
    // useStartupInit (haptics aren't needed for first paint), so an early tap
    // — e.g. a tab press that beats the idle callback — can reach here before
    // init. Self-initialize on first use so the preference is cached and the
    // store subscription is wired up, rather than reading a one-off uncached
    // value on every early call. `initialize()` is idempotent.
    if (!this.initialized) {
      this.initialize();
    }
    return (this.enabledPreference ?? true) && this.supported;
  }

  isSupported(): boolean {
    return this.supported;
  }

  trigger(type: HapticFeedbackType): void {
    if (!this.isEnabled()) return;
    try {
      triggerHaptic(NATIVE_TYPE[type], TRIGGER_OPTIONS);
    } catch (error) {
      logger.warn('[HapticService] Failed to trigger haptic feedback:', error);
    }
  }

  /**
   * Native-iOS haptics don't support cancellation (each tap is a discrete
   * event). Kept as a no-op so existing callsites compile; the Android
   * fallback also can't be cancelled mid-pulse through this library.
   */
  cancel(): void {}

  light() {
    this.trigger(HapticFeedbackType.LIGHT);
  }
  medium() {
    this.trigger(HapticFeedbackType.MEDIUM);
  }
  heavy() {
    this.trigger(HapticFeedbackType.HEAVY);
  }
  success() {
    this.trigger(HapticFeedbackType.SUCCESS);
  }
  warning() {
    this.trigger(HapticFeedbackType.WARNING);
  }
  error() {
    this.trigger(HapticFeedbackType.ERROR);
  }
  selection() {
    this.trigger(HapticFeedbackType.SELECTION);
  }
  longPress() {
    this.trigger(HapticFeedbackType.LONG_PRESS);
  }
}

export const HapticService = new HapticFeedbackService();
export type { HapticFeedbackService };
