import { useCallback, useRef, useEffect } from 'react';
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
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
 * PERFORMANCE: Uses eager shared value creation but defers animation calculations.
 * The animated style returns static values when exitDirection === 0 (no animation),
 * avoiding expensive animation calculations until the user actually triggers one.
 *
 * Uses runOnJS for accurate animation completion callbacks instead of setTimeout.
 *
 * Layout animations for remaining items (sliding up to fill the gap) are handled by
 * DraggableFlatList's itemLayoutAnimation prop with enableLayoutAnimationExperimental={true}.
 * A patch to react-native-draggable-flatlist guards against missing LayoutAnimationRepository
 * API in Reanimated 4.x (see patches/react-native-draggable-flatlist+4.0.3.patch).
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
  // Shared value for exit direction - created eagerly but idle until animation triggers
  // Value: 0 = no animation, 1 = animating right, -1 = animating left
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
  // PERFORMANCE: Returns static values when exitDirection === 0 (no animation triggered)
  // All visual properties derive from the single animated exitDirection.value (0 to 1 or -1)
  const exitAnimatedStyle = useAnimatedStyle(() => {
    // Fast path: no animation active, return static values
    if (exitDirection.value === 0) {
      return {
        opacity: 1,
        transform: [{ translateX: 0 }, { scale: 1 }],
      };
    }

    const progress = Math.abs(exitDirection.value); // 0 to 1
    const { slide, scale } = listItemExitAnimation;

    return {
      opacity: 1 - progress, // Fade out as progress increases
      transform: [
        { translateX: exitDirection.value * slide.distance }, // Slide in direction
        { scale: 1 - progress * (1 - scale.toValue) }, // Scale from 1 to 0.95
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

      // Animate exitDirection.value from 0 to 1 (or -1)
      // The useAnimatedStyle derives all visual properties from this single animated value
      exitDirection.value = withTiming(
        direction,
        { duration: slide.duration, easing: standardEasing },
        finished => {
          'worklet';
          if (finished) {
            runOnJS(safeCallComplete)();
          }
        },
      );
    },
    [exitDirection, safeCallComplete],
  );

  /**
   * Reset animation state (for reuse or error recovery)
   */
  const resetAnimation = useCallback(() => {
    // Reset ref state (non-blocking)
    isAnimatingRef.current = false;
    // Reset shared value to neutral
    exitDirection.value = 0;
  }, [exitDirection]);

  return {
    exitAnimatedStyle,
    triggerExit,
    resetAnimation,
  };
};
