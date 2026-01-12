import { useLayoutEffect, useMemo } from 'react';
import { useListExitAnimation } from './useListExitAnimation';
import { useListEntryAnimation } from './useListEntryAnimation';
import { useListAnimationOptional } from '#/context/ListAnimationContext';

/**
 * Combined hook for list item animations
 *
 * Combines exit and entry animations into a single hook for simpler component usage.
 * Handles registration of the exit animation trigger with the animation context.
 *
 * This hook provides:
 * - Exit animation (slide + fade + scale when item leaves list)
 * - Entry animation (slide + fade when item appears in list)
 * - Automatic trigger registration for subscription-based animations
 *
 * PERFORMANCE: Both underlying hooks use optimized shared values that return
 * static values when no animation is active.
 *
 * IMPORTANT: Handles FlashList view recycling via itemId parameter.
 *
 * @param itemId - Unique identifier for the list item
 * @returns Combined animation styles and exit trigger
 *
 * @example
 * ```tsx
 * const { animatedStyle, triggerExit } = useListItemAnimation(item.id);
 *
 * // For user-triggered animations (e.g., checkbox toggle)
 * const handleToggle = () => {
 *   triggerExit(1, () => onToggle(item.id));
 * };
 *
 * // Subscription-triggered animations are handled automatically
 * // via the animation context registration
 *
 * <Animated.View style={[styles.container, animatedStyle]}>
 *   {content}
 * </Animated.View>
 * ```
 */
export const useListItemAnimation = (itemId: string) => {
  // Get individual animation hooks
  const { exitAnimatedStyle, triggerExit, resetAnimation } = useListExitAnimation(itemId);
  const { entryAnimatedStyle } = useListEntryAnimation(itemId);

  // Get animation context for registration
  const animationContext = useListAnimationOptional();

  // Register exit animation trigger with context
  // This enables subscription handlers to trigger exit animations directly (O(1), no re-renders)
  useLayoutEffect(() => {
    if (!animationContext) return;

    // Register this item's animation trigger function
    animationContext.registerAnimationTrigger(itemId, triggerExit);

    return () => {
      // Clean up registration on unmount (handles FlashList view recycling)
      animationContext.unregisterAnimationTrigger(itemId);
    };
  }, [itemId, triggerExit, animationContext]);

  // Combine exit and entry animated styles
  // Both hooks return empty objects when no animation is active,
  // so combining them has minimal overhead
  const animatedStyle = useMemo(
    () => [exitAnimatedStyle, entryAnimatedStyle],
    [exitAnimatedStyle, entryAnimatedStyle],
  );

  return {
    /** Combined animated style (exit + entry) */
    animatedStyle,
    /** Trigger exit animation manually (for user-initiated actions) */
    triggerExit,
    /** Reset animation state (for error recovery) */
    resetAnimation,
    /** Individual exit animated style (if needed separately) */
    exitAnimatedStyle,
    /** Individual entry animated style (if needed separately) */
    entryAnimatedStyle,
  };
};

// Re-export type for convenience
export type { AnimationDirection } from '#/types/animations';
