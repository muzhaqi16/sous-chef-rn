import { useEffect, useRef } from 'react';
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  DEFAULT_ENTRY_ANIMATION,
  standardEasing,
} from '../../constants/animations';
import { useListAnimationOptional } from '../../contexts/ListAnimationContext';
import type { EntryAnimationConfig } from '../../types';

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
 * @param configOverrides - Optional animation configuration overrides
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
export const useListEntryAnimation = (
  itemId: string,
  configOverrides?: Partial<EntryAnimationConfig>,
) => {
  const animationContext = useListAnimationOptional();

  // Merge config with defaults
  const config = {
    fade: { ...DEFAULT_ENTRY_ANIMATION.fade, ...configOverrides?.fade },
    slide: { ...DEFAULT_ENTRY_ANIMATION.slide, ...configOverrides?.slide },
  };

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
      // Start from offset position (slide in from direction)
      translateX.value = entry.direction * config.slide.distance;
      opacity.value = 0;

      // Animate to final position
      translateX.value = withTiming(0, {
        duration: config.slide.duration,
        easing: standardEasing,
      });
      opacity.value = withTiming(1, {
        duration: config.fade.duration,
        easing: standardEasing,
      });
    }
  }, [itemId, animationContext, translateX, opacity, config.slide, config.fade]);

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
