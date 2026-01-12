import { useCallback, useRef, useEffect } from 'react';
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { listItemExitAnimation, listItemFastExitAnimation, standardEasing } from '#/constants/animations';
import type { AnimationDirection } from '#/types/animations';

/**
 * Animation preset type for exit animations
 * - 'default': Standard 300ms exit animation (for swipe/delete actions)
 * - 'fast': Quick 200ms exit animation (for checkbox toggles)
 */
export type ExitAnimationPreset = 'default' | 'fast';

// Animation configs by preset
const animationConfigs = {
  default: listItemExitAnimation,
  fast: listItemFastExitAnimation,
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
 * Uses runOnJS for accurate animation completion callbacks instead of setTimeout.
 *
 * Layout animations for remaining items (sliding up to fill the gap) are handled by
 * FlashList with custom drag-to-reorder implementation using gesture handler and Reanimated.
 *
 * IMPORTANT: This hook handles FlashList view recycling by accepting an itemId parameter.
 * When the itemId changes (view recycled for a different item), all animation state is reset.
 * @see https://shopify.github.io/flash-list/docs/guides/reanimated
 *
 * @param itemId - Unique identifier for the list item (used to detect view recycling)
 * @returns Animation styles and trigger functions
 *
 * @example
 * ```tsx
 * const { exitAnimatedStyle, triggerExit } = useListExitAnimation(item.id);
 *
 * // Trigger exit animation
 * triggerExit(1, () => {
 *   onItemMoved(item.id);
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

  // PERFORMANCE: Track current animation config on UI thread for smooth animation
  // This allows exitAnimatedStyle to use the correct slide distance per preset
  // Type annotation needed to allow both preset values (200/300 for distance, 0.95/0.97 for scale)
  const slideDistance = useSharedValue<number>(listItemFastExitAnimation.slide.distance);
  const scaleToValue = useSharedValue<number>(listItemFastExitAnimation.scale.toValue);

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

  // Reset ONLY visual animation state when view is recycled (item ID changes)
  // Per FlashList docs: https://shopify.github.io/flash-list/docs/guides/reanimated/
  //
  // We reset:
  // - exitDirection.value: Prevents ghost animations from previous item
  // - isAnimatingRef: Allows new animations to start (previous animation is orphaned)
  // - slideDistance/scaleToValue: Reset to fast preset defaults
  //
  // We DON'T reset onCompleteRef because:
  // - If animation completed: callback already called and nulled by safeCallComplete
  // - If animation pending: it will be orphaned (wrong item), but
  //   new triggerExit call will overwrite with correct callback
  useEffect(() => {
    exitDirection.value = 0;
    slideDistance.value = listItemFastExitAnimation.slide.distance;
    scaleToValue.value = listItemFastExitAnimation.scale.toValue;
    isAnimatingRef.current = false;
    // Note: onCompleteRef is intentionally NOT reset here
  }, [itemId, exitDirection, slideDistance, scaleToValue]);

  // Exit animated style (slide, fade, scale)
  // PERFORMANCE: Returns static values when exitDirection === 0 (no animation triggered)
  // All visual properties derive from the single animated exitDirection.value (0 to 1 or -1)
  // Uses slideDistance and scaleToValue SharedValues to support different animation presets
  const exitAnimatedStyle = useAnimatedStyle(() => {
    // Fast path: no animation active, return static values
    if (exitDirection.value === 0) {
      return {
        opacity: 1,
        transform: [{ translateX: 0 }, { scale: 1 }],
      };
    }

    const progress = Math.abs(exitDirection.value); // 0 to 1

    return {
      opacity: 1 - progress, // Fade out as progress increases
      transform: [
        { translateX: exitDirection.value * slideDistance.value }, // Slide in direction
        { scale: 1 - progress * (1 - scaleToValue.value) }, // Scale from 1 to target
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
   * Trigger exit animation with direction, completion callback, and optional preset
   * @param direction - 1 for forward/right, -1 for backward/left
   * @param onComplete - Callback fired when animation completes
   * @param preset - Animation preset: 'default' (300ms) or 'fast' (200ms for checkbox toggles)
   */
  const triggerExit = useCallback(
    (direction: AnimationDirection, onComplete: () => void, preset: ExitAnimationPreset = 'fast') => {
      // Guard against rapid toggling - non-blocking ref read
      if (isAnimatingRef.current) return;

      // Set animating state - non-blocking ref write
      isAnimatingRef.current = true;
      onCompleteRef.current = onComplete;

      // PERFORMANCE: Use faster preset by default for checkbox toggles
      // The 'fast' preset (200ms) provides snappier feedback for common actions
      const config = animationConfigs[preset];

      // Set animation config SharedValues BEFORE starting animation
      // This ensures exitAnimatedStyle uses the correct values
      slideDistance.value = config.slide.distance;
      scaleToValue.value = config.scale.toValue;

      // Animate exitDirection.value from 0 to 1 (or -1)
      // The useAnimatedStyle derives all visual properties from this single animated value
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
