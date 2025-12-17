import { useCallback } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
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
  const isAnimating = useSharedValue(false);

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

  /**
   * Trigger exit animation with direction and completion callback
   * @param direction - 1 for right (marking purchased), -1 for left (unmarking)
   * @param onComplete - Callback fired during animation (overlaps with fade)
   */
  const triggerExit = useCallback(
    (direction: 1 | -1, onComplete: () => void) => {
      // Guard against rapid toggling
      if (isAnimating.value) return;

      isAnimating.value = true;
      exitDirection.value = direction;

      const { slide, removalDelay } = listItemExitAnimation;

      // Start the slide animation
      exitDirection.value = withTiming(direction * slide.distance, {
        duration: slide.duration,
        easing: standardEasing,
      });

      // Trigger removal during the fade animation (not after slide completes)
      // This creates overlap: item fades while others move up
      // LayoutAnimation is handled by SortableList when items prop changes
      setTimeout(onComplete, removalDelay);
    },
    [exitDirection, isAnimating],
  );

  /**
   * Reset animation state (for reuse or error recovery)
   */
  const resetAnimation = useCallback(() => {
    exitDirection.value = 0;
    isAnimating.value = false;
  }, [exitDirection, isAnimating]);

  return {
    exitAnimatedStyle,
    triggerExit,
    resetAnimation,
  };
};
