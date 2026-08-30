import { Platform } from 'react-native';
import {
  trigger as triggerHaptic,
  HapticFeedbackTypes,
} from 'react-native-haptic-feedback';
import { useStore } from '#store';
import { logger } from '#/utils/environment';

/**
 * iOS produces real haptics; Android falls back to vibration patterns when the
 * device has no haptic actuator.
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

  /** Caches the preference and subscribes to changes; idempotent. */
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
    // useStartupInit defers initialize() to the idle queue, so an early tap can
    // beat it — self-initialize rather than read an uncached value each time.
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

  /** No-op: neither platform can cancel a haptic mid-pulse through this library. */
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
