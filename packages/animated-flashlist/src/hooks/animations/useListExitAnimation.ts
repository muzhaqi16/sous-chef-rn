import { useCallback, useRef, useEffect } from 'react';
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import {
  FAST_EXIT_ANIMATION,
  DEFAULT_EXIT_ANIMATION,
  standardEasing,
} from '../../constants/animations';
import type { AnimationDirection, ExitAnimationPreset } from '../../types';

// Animation configs by preset
const animationConfigs = {
  default: DEFAULT_EXIT_ANIMATION,
  fast: FAST_EXIT_ANIMATION,
} as const;

/**
 * Hook for managing list item exit animations
 *
 * Provides coordinated slide, fade, and scale animations for items
 * exiting a list (e.g., moving between sections, being deleted).
 *
 * PERFORMANCE: Uses eager shared value creation but defers animation calculations.
 * The animated style returns static values when exitDirection === 0 (no animation),
 * avoiding expensive animation calculations until the user actually triggers one.
 *
 * IMPORTANT: This hook handles FlashList view recycling by accepting an itemId parameter.
 * When the itemId changes (view recycled for a different item), all animation state is reset.
 *
 * @param itemId - Unique identifier for the list item (used to detect view recycling)
 * @returns Animation styles and trigger functions
 *
 * @example
 * ```tsx
 * const { exitAnimatedStyle, triggerExit, resetAnimation } = useListExitAnimation(item.id);
 *
 * // Trigger exit animation
 * triggerExit(1, () => {
 *   onItemRemoved(item.id);
 * });
 *
 * // Apply styles
 * <Animated.View style={exitAnimatedStyle}>
 *   {content}
 * </Animated.View>
 * ```
 */
export const useListExitAnimation = (itemId: string) => {
  // Shared value for exit direction - created eagerly but idle until animation triggers
  // Value: 0 = no animation, 1 = animating right, -1 = animating left
  const exitDirection = useSharedValue(0);

  // Track current animation config on UI thread for smooth animation
  const slideDistance = useSharedValue<number>(FAST_EXIT_ANIMATION.slide.distance);
  const scaleToValue = useSharedValue<number>(FAST_EXIT_ANIMATION.scale.toValue);

  // Use useRef instead of useSharedValue for isAnimating flag
  const isAnimatingRef = useRef(false);

  // Refs for callback management and unmount safety
  const onCompleteRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      onCompleteRef.current = null;
    };
  }, []);

  // Reset animation state when view is recycled (item ID changes)
  useEffect(() => {
    exitDirection.value = 0;
    slideDistance.value = FAST_EXIT_ANIMATION.slide.distance;
    scaleToValue.value = FAST_EXIT_ANIMATION.scale.toValue;
    isAnimatingRef.current = false;
  }, [itemId, exitDirection, slideDistance, scaleToValue]);

  // Exit animated style (slide, fade, scale)
  const exitAnimatedStyle = useAnimatedStyle(() => {
    // Fast path: no animation active, return static values
    if (exitDirection.value === 0) {
      return {
        opacity: 1,
        transform: [{ translateX: 0 }, { scale: 1 }],
      };
    }

    const progress = Math.abs(exitDirection.value);

    return {
      opacity: 1 - progress,
      transform: [
        { translateX: exitDirection.value * slideDistance.value },
        { scale: 1 - progress * (1 - scaleToValue.value) },
      ],
    };
  });

  // Helper function to safely call the completion callback
  const safeCallComplete = useCallback(() => {
    if (isMountedRef.current && onCompleteRef.current) {
      onCompleteRef.current();
      onCompleteRef.current = null;
    }
    isAnimatingRef.current = false;
  }, []);

  /**
   * Trigger exit animation with direction, completion callback, and optional preset
   * @param direction - 1 for forward/right, -1 for backward/left
   * @param onComplete - Callback fired when animation completes
   * @param preset - Animation preset: 'default' (300ms) or 'fast' (200ms)
   */
  const triggerExit = useCallback(
    (
      direction: AnimationDirection,
      onComplete: () => void,
      preset: ExitAnimationPreset = 'fast',
    ) => {
      // Guard against rapid toggling
      if (isAnimatingRef.current) return;

      isAnimatingRef.current = true;
      onCompleteRef.current = onComplete;

      const config = animationConfigs[preset];

      // Set animation config SharedValues BEFORE starting animation
      slideDistance.value = config.slide.distance;
      scaleToValue.value = config.scale.toValue;

      // Animate exitDirection.value from 0 to 1 (or -1)
      exitDirection.value = withTiming(
        direction,
        { duration: config.slide.duration, easing: standardEasing },
        finished => {
          'worklet';
          if (finished) {
            scheduleOnRN(safeCallComplete);
          }
        },
      );
    },
    [exitDirection, slideDistance, scaleToValue, safeCallComplete],
  );

  /**
   * Reset animation state (for reuse or error recovery)
   */
  const resetAnimation = useCallback(() => {
    isAnimatingRef.current = false;
    exitDirection.value = 0;
  }, [exitDirection]);

  return {
    exitAnimatedStyle,
    triggerExit,
    resetAnimation,
  };
};
