import { useCallback, useRef, useEffect } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  runOnJS,
  runOnUI,
} from 'react-native-reanimated';
import {
  listItemExitAnimation,
  standardEasing,
} from '#/constants/animations';

/**
 * Hook for managing list item exit animations
 *
 * Provides coordinated slide, fade, and scale animations
 * for when items are toggled between purchased/unpurchased states.
 *
 * PERFORMANCE: Uses useRef for isAnimating state to avoid blocking the JS thread.
 * Reading/writing SharedValue.value on JS thread triggers executeOnUIRuntimeSync
 * which blocks execution. Using useRef + runOnUI avoids this blocking.
 *
 * Uses runOnJS for accurate animation completion callbacks instead of setTimeout.
 *
 * @returns Animation styles and trigger functions
 *
 * @example
 * ```tsx
 * const { exitAnimatedStyle, triggerExit } = useItemExitAnimation();
 *
 * // Trigger exit animation
 * triggerExit(1, () => {
 *   onTogglePurchase(item.id);
 * });
 *
 * // Apply styles
 * <Animated.View style={exitAnimatedStyle}>
 *   {content}
 * </Animated.View>
 * ```
 */
export const useItemExitAnimation = () => {
  // 0 = no animation, 1 = exiting right (marking purchased), -1 = exiting left (unmarking)
  const exitDirection = useSharedValue(0);

  // PERFORMANCE: Use useRef instead of useSharedValue for isAnimating flag
  // This avoids blocking the JS thread when checking/setting animation state
  const isAnimatingRef = useRef(false);

  // Refs for callback management and unmount safety
  const onCompleteRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef(true);

  // Cleanup on unmount to prevent callback firing on unmounted component
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      onCompleteRef.current = null;
    };
  }, []);

  // Exit animated style (slide, fade, scale)
  const exitAnimatedStyle = useAnimatedStyle(() => {
    const isActive = exitDirection.value !== 0;
    const { slide, fade, scale } = listItemExitAnimation;

    return {
      opacity: isActive
        ? withDelay(fade.delay, withTiming(0, { duration: fade.duration }))
        : withTiming(1, { duration: fade.duration }),
      transform: [
        {
          translateX: withTiming(exitDirection.value * slide.distance, {
            duration: slide.duration,
            easing: standardEasing,
          }),
        },
        {
          scale: isActive
            ? withDelay(
                scale.delay,
                withTiming(scale.toValue, { duration: scale.duration }),
              )
            : withTiming(1, { duration: scale.duration }),
        },
      ],
    };
  });

  // Helper function to safely call the completion callback and reset state
  // Must be defined outside worklet to be called via runOnJS
  const safeCallComplete = useCallback(() => {
    if (isMountedRef.current && onCompleteRef.current) {
      onCompleteRef.current();
      onCompleteRef.current = null;
    }
    // Reset animating state on JS thread (non-blocking)
    isAnimatingRef.current = false;
  }, []);

  /**
   * Trigger exit animation with direction and completion callback
   * PERFORMANCE: Uses runOnUI to schedule animation without blocking JS thread
   * @param direction - 1 for right (marking purchased), -1 for left (unmarking)
   * @param onComplete - Callback fired when animation completes
   */
  const triggerExit = useCallback(
    (direction: 1 | -1, onComplete: () => void) => {
      // Guard against rapid toggling - non-blocking ref read
      if (isAnimatingRef.current) return;

      // Set animating state - non-blocking ref write
      isAnimatingRef.current = true;
      onCompleteRef.current = onComplete;

      const { slide } = listItemExitAnimation;

      // PERFORMANCE: Schedule animation on UI thread without blocking JS thread
      // This avoids executeOnUIRuntimeSync which would block the JS thread
      runOnUI(() => {
        'worklet';
        exitDirection.value = withTiming(
          direction * slide.distance,
          { duration: slide.duration, easing: standardEasing },
          finished => {
            'worklet';
            if (finished) {
              runOnJS(safeCallComplete)();
            }
          },
        );
      })();
    },
    [exitDirection, safeCallComplete],
  );

  /**
   * Reset animation state (for reuse or error recovery)
   */
  const resetAnimation = useCallback(() => {
    // Reset ref state (non-blocking)
    isAnimatingRef.current = false;

    // Schedule shared value reset on UI thread (non-blocking)
    runOnUI(() => {
      'worklet';
      exitDirection.value = 0;
    })();
  }, [exitDirection]);

  return {
    exitAnimatedStyle,
    triggerExit,
    resetAnimation,
  };
};
