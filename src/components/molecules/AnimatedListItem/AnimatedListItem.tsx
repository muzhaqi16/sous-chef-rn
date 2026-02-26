import React, { forwardRef, useImperativeHandle } from 'react';
import { useWindowDimensions, type ViewStyle, type StyleProp } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSlideAnimation } from '#hooks/animations/useSlideAnimation';
import type { SlideAnimationConfig, SlideDirection } from '#hooks/animations/types';

export interface AnimatedListItemRef {
  /** Trigger the slide animation. direction: 1 = right, -1 = left */
  triggerSlide: (direction: SlideDirection, onComplete?: () => void) => void;
  /** Reset slide position to origin */
  resetSlide: () => void;
  /** Whether animation is currently in progress */
  isAnimating: boolean;
}

export interface AnimatedListItemProps {
  /** Unique identifier for the item (required for FlashList recycling) */
  itemId: string;
  /** Children to render inside the animated container */
  children: React.ReactNode;
  /** Slide animation configuration (use SLIDE_PRESETS or custom config) */
  slideConfig?: Partial<SlideAnimationConfig>;
  /** Additional styles to apply to the container */
  style?: StyleProp<ViewStyle>;
  /** Disable animations (useful for conditional animation) */
  disabled?: boolean;
}

/**
 * Generic wrapper component that adds slide animation to any list item.
 *
 * Handles FlashList view recycling automatically by resetting animation state
 * when the itemId changes.
 *
 * @example
 * ```tsx
 * import { AnimatedListItem, type AnimatedListItemRef } from '#/components/molecules/AnimatedListItem/AnimatedListItem';
 * import { SLIDE_PRESETS } from '#/constants/animations';
 *
 * const MyListItem = ({ item, onDelete }) => {
 *   const animatedRef = useRef<AnimatedListItemRef>(null);
 *
 *   const handleDelete = () => {
 *     animatedRef.current?.triggerSlide(1, () => onDelete(item.id));
 *   };
 *
 *   return (
 *     <AnimatedListItem
 *       ref={animatedRef}
 *       itemId={item.id}
 *       slideConfig={SLIDE_PRESETS.exitWithFade}
 *     >
 *       <ItemCard onDelete={handleDelete} />
 *     </AnimatedListItem>
 *   );
 * };
 * ```
 */
export const AnimatedListItem = forwardRef<AnimatedListItemRef, AnimatedListItemProps>(
  ({ itemId, children, slideConfig, style, disabled = false }, ref) => {
    const { width: screenWidth } = useWindowDimensions();

    // Resolve slideDistance - handle 'screenWidth' special value
    const resolvedSlideDistance =
      slideConfig?.slideDistance === 'screenWidth'
        ? screenWidth
        : typeof slideConfig?.slideDistance === 'number'
          ? slideConfig.slideDistance
          : 50;

    const { animatedSlideStyle, triggerSlide, resetSlide, isAnimating } = useSlideAnimation({
      itemId,
      slideDistance: resolvedSlideDistance,
      duration: slideConfig?.duration,
      easing: slideConfig?.easing,
      withOpacity: slideConfig?.withOpacity,
      opacityTarget: slideConfig?.opacityTarget,
      allowedDirections: slideConfig?.allowedDirections,
      disabled,
    });

    // Expose imperative API via ref
    useImperativeHandle(
      ref,
      () => ({
        triggerSlide,
        resetSlide,
        get isAnimating() { return isAnimating.value; },
      }),
      [triggerSlide, resetSlide, isAnimating],
    );

    return (
      <Animated.View style={[style, animatedSlideStyle]}>
        {children}
      </Animated.View>
    );
  },
);

AnimatedListItem.displayName = 'AnimatedListItem';
