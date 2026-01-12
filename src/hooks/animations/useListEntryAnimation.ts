import { useEffect, useRef } from 'react';
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { listItemEntryAnimation, standardEasing } from '#/constants/animations';
import { useListAnimationOptional } from '#/context/ListAnimationContext';

/**
 * Hook for managing list item entry animations
 *
 * Provides coordinated slide and fade animations for items appearing
 * in a new list (e.g., after being moved via subscription update).
 *
 * PERFORMANCE: Uses shared values with static defaults.
 * Animation only triggers when an entry animation is claimed.
 *
 * IMPORTANT: This hook handles FlashList view recycling by accepting an itemId parameter.
 * When the itemId changes (view recycled for a different item), animation state is reset.
 *
 * @param itemId - Unique identifier for the list item (used to detect view recycling)
 * @returns Animation styles for entry effect
 *
 * @example
 * ```tsx
 * const { entryAnimatedStyle } = useListEntryAnimation(item.id);
 *
 * <Animated.View style={[styles.container, entryAnimatedStyle]}>
 *   {content}
 * </Animated.View>
 * ```
 */
export const useListEntryAnimation = (itemId: string) => {
  const animationContext = useListAnimationOptional();

  // Shared values for entry animation - start at final position (no animation by default)
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);

  // Track if we've already checked for entry animation for this item
  const hasCheckedRef = useRef(false);
  const lastItemIdRef = useRef(itemId);

  // Reset check flag when item ID changes (view recycled)
  if (lastItemIdRef.current !== itemId) {
    lastItemIdRef.current = itemId;
    hasCheckedRef.current = false;
    // Reset animation values for new item
    translateX.value = 0;
    opacity.value = 1;
  }

  // Check for pending entry animation on mount
  useEffect(() => {
    if (!animationContext || hasCheckedRef.current) return;

    hasCheckedRef.current = true;

    const entry = animationContext.claimEntryAnimation(itemId);
    if (entry) {
      const { slide, fade } = listItemEntryAnimation;

      // Start from offset position (slide in from direction)
      // direction: 1 = from right (forward), -1 = from left (backward)
      translateX.value = entry.direction * slide.distance;
      opacity.value = 0;

      // Animate to final position
      translateX.value = withTiming(0, {
        duration: slide.duration,
        easing: standardEasing,
      });
      opacity.value = withTiming(1, {
        duration: fade.duration,
        easing: standardEasing,
      });
    }
  }, [itemId, animationContext, translateX, opacity]);

  // Animated style for entry effect
  const entryAnimatedStyle = useAnimatedStyle(() => {
    // Fast path: no animation active (default state)
    if (translateX.value === 0 && opacity.value === 1) {
      return {};
    }

    return {
      opacity: opacity.value,
      transform: [{ translateX: translateX.value }],
    };
  });

  return {
    entryAnimatedStyle,
  };
};
