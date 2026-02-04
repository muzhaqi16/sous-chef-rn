import { useCallback } from 'react';
import { HapticService, HapticFeedbackType } from '#services/haptic/HapticService';

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
  const trigger = useCallback((type: HapticFeedbackType) => {
    HapticService.trigger(type);
  }, []);

  // Memoized convenience methods
  const light = useCallback(() => {
    HapticService.light();
  }, []);

  const medium = useCallback(() => {
    HapticService.medium();
  }, []);

  const heavy = useCallback(() => {
    HapticService.heavy();
  }, []);

  const success = useCallback(() => {
    HapticService.success();
  }, []);

  const warning = useCallback(() => {
    HapticService.warning();
  }, []);

  const error = useCallback(() => {
    HapticService.error();
  }, []);

  const selection = useCallback(() => {
    HapticService.selection();
  }, []);

  const longPress = useCallback(() => {
    HapticService.longPress();
  }, []);

  const cancel = useCallback(() => {
    HapticService.cancel();
  }, []);

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
