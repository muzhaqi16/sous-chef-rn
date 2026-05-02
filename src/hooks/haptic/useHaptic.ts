import {
  HapticService,
  HapticFeedbackType,
} from '#services/haptic/HapticService';

/**
 * Custom hook for haptic feedback
 *
 * Provides a convenient React hook interface to the HapticService.
 * Returns memoized callback functions for triggering haptic feedback.
 *
 * @returns Object with haptic feedback methods
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   const haptic = useHaptic();
 *
 *   const handleDelete = () => {
 *     haptic.warning(); // Trigger warning haptic
 *     // ... delete logic
 *   };
 *
 *   const handleSuccess = () => {
 *     haptic.success(); // Trigger success haptic
 *     // ... success logic
 *   };
 *
 *   return <Button onPress={handleDelete}>Delete</Button>;
 * }
 * ```
 */
export function useHaptic() {
  // Memoized trigger function
  const trigger = (type: HapticFeedbackType) => {
    HapticService.trigger(type);
  };

  // Memoized convenience methods
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
