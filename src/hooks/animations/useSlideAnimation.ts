import { useRef } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useRecyclingState } from '@shopify/flash-list';
import type {
  SlideDirection,
  UseSlideAnimationOptions,
  UseSlideAnimationReturn,
} from './types';
import { motion } from '#/theme/foundations/motion';

const defaultEasing = motion.easing.standard;

/**
 * Slide animation for FlashList rows. The exit slide completes BEFORE the state
 * change fires, so FlashList cannot recycle the view mid-animation, and
 * `useRecyclingState` resets shared values when `itemId` changes.
 * @see https://shopify.github.io/flash-list/docs/guides/reanimated/
 */
export function useSlideAnimation({
  itemId,
  slideDistance = 30,
  duration = motion.timing.STANDARD,
  easing,
  withOpacity = false,
  opacityTarget = 0,
  allowedDirections = 'both',
  disabled = false,
}: UseSlideAnimationOptions): UseSlideAnimationReturn {
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);
  const isAnimatingShared = useSharedValue(false);

  const onCompleteRef = useRef<(() => void) | null>(null);

  // scheduleOnRN requires a function defined in RN-runtime scope, so a dynamic
  // callback has to travel through this stable wrapper.
  const executeOnComplete = () => {
    const callback = onCompleteRef.current;
    onCompleteRef.current = null;
    callback?.();
  };

  // onReset fires inside useMemo — during render, BEFORE paint — so a recycled
  // view never briefly shows the previous item's shared values.
  useRecyclingState(undefined, [itemId], () => {
    cancelAnimation(translateX);
    cancelAnimation(opacity);
    translateX.set(0);
    opacity.set(1);
    isAnimatingShared.set(false);
    onCompleteRef.current = null;
  });

  const animatedSlideStyle = useAnimatedStyle(() => {
    const style: { transform: { translateX: number }[]; opacity?: number } = {
      transform: [{ translateX: translateX.get() }],
    };
    if (withOpacity) {
      style.opacity = opacity.get();
    }
    return style;
  });

  const triggerSlide = (direction: SlideDirection, onComplete?: () => void) => {
    if (disabled) {
      if (onComplete) {
        onCompleteRef.current = onComplete;
        executeOnComplete();
      }
      return;
    }

    if (allowedDirections === 'right' && direction === -1) return;
    if (allowedDirections === 'left' && direction === 1) return;

    // Re-entry guard: a double tap must not restart the slide.
    if (isAnimatingShared.get()) return;

    isAnimatingShared.set(true);

    if (onComplete) {
      onCompleteRef.current = onComplete;
    }

    const animationEasing = easing ?? defaultEasing;
    const timingConfig = { duration, easing: animationEasing };

    if (withOpacity) {
      opacity.set(withTiming(opacityTarget, timingConfig));
    }

    translateX.set(
      withTiming(direction * slideDistance, timingConfig, finished => {
        'worklet';
        isAnimatingShared.set(false);
        if (finished && onComplete) {
          scheduleOnRN(executeOnComplete);
        }
      }),
    );
  };

  const resetSlide = () => {
    cancelAnimation(translateX);
    cancelAnimation(opacity);
    translateX.set(
      withTiming(0, { duration: duration / 2, easing: defaultEasing }),
    );
    if (withOpacity) {
      opacity.set(
        withTiming(1, { duration: duration / 2, easing: defaultEasing }),
      );
    }
    isAnimatingShared.set(false);
  };

  return {
    animatedSlideStyle,
    triggerSlide,
    resetSlide,
    isAnimating: isAnimatingShared,
  };
}
