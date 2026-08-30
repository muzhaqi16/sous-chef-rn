import {
  HapticService,
  HapticFeedbackType,
} from '#services/haptic/HapticService';

/** React interface over `HapticService`. */
export function useHaptic() {
  const trigger = (type: HapticFeedbackType) => {
    HapticService.trigger(type);
  };

  const light = () => {
    HapticService.light();
  };

  const medium = () => {
    HapticService.medium();
  };

  const heavy = () => {
    HapticService.heavy();
  };

  const success = () => {
    HapticService.success();
  };

  const warning = () => {
    HapticService.warning();
  };

  const error = () => {
    HapticService.error();
  };

  const selection = () => {
    HapticService.selection();
  };

  const longPress = () => {
    HapticService.longPress();
  };

  const cancel = () => {
    HapticService.cancel();
  };

  return {
    trigger,
    light,
    medium,
    heavy,
    success,
    warning,
    error,
    selection,
    longPress,
    cancel,
    isEnabled: HapticService.isEnabled(),
    isSupported: HapticService.isSupported(),
  };
}
