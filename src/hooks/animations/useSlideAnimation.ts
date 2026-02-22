import { useRef, useEffect, useCallback, useState } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type {
  SlideDirection,
  UseSlideAnimationOptions,
  UseSlideAnimationReturn,
} from './types';

/** Default easing: standard cubic bezier for smooth animations */
const defaultEasing = Easing.bezier(0.25, 0.1, 0.25, 1);

/**
 * Reusable slide animation hook for FlashList items.
 * Properly handles view recycling by resetting state when itemId changes.
 *
 * Animation: Exit slide that completes BEFORE triggering state change.
 * This ensures FlashList can't recycle the view mid-animation.
 *
 * Production guards:
 * - Re-entry guard prevents double-tap issues
 * - scheduleOnRN ensures callback runs on RN thread after animation
 *
 * @example
 * ```tsx
 * // Basic usage
 * const { animatedSlideStyle, triggerSlide } = useSlideAnimation({ itemId: item.id });
 *
 * // With opacity fade
 * const { animatedSlideStyle, triggerSlide } = useSlideAnimation({
 *   itemId: item.id,
 *   slideDistance: 200,
 *   withOpacity: true,
 *   opacityTarget: 0,
 * });
 *
 * // Restricted to right-only slide
 * const { animatedSlideStyle, triggerSlide } = useSlideAnimation({
 *   itemId: item.id,
 *   allowedDirections: 'right',
 * });
 * ```
 *
 * @see https://shopify.github.io/flash-list/docs/guides/reanimated/
 */
export function useSlideAnimation({
  itemId,
  slideDistance = 30,
  duration = 200,
  easing,
  withOpacity = false,
  opacityTarget = 0,
  allowedDirections = 'both',
  disabled = false,
}: UseSlideAnimationOptions): UseSlideAnimationReturn {
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);
  const isAnimatingShared = useSharedValue(false);
  const itemIdRef = useRef(itemId);

  // Track animation state for JS-side consumers
  const [isAnimating, setIsAnimating] = useState(false);

  // Ref to store pending completion callback
  // This allows dynamic callbacks to be invoked via a stable RN-runtime wrapper
  const onCompleteRef = useRef<(() => void) | null>(null);

  const updateAnimatingState = useCallback((animating: boolean) => {
    setIsAnimating(animating);
  }, []);

  // Stable wrapper for completion callback - defined in RN runtime
  // scheduleOnRN requires functions to be defined in RN runtime scope
  const executeOnComplete = useCallback(() => {
    const callback = onCompleteRef.current;
    onCompleteRef.current = null;
    callback?.();
  }, []);

  // Reset when FlashList recycles this view for a different item
  useEffect(() => {
    if (itemIdRef.current !== itemId) {
      cancelAnimation(translateX);
      cancelAnimation(opacity);
      translateX.set(0);
      opacity.set(1);
      isAnimatingShared.set(false);
      setIsAnimating(false);
      onCompleteRef.current = null; // Clear pending callback
      itemIdRef.current = itemId;
    }
  }, [itemId, translateX, opacity, isAnimatingShared]);

  const animatedSlideStyle = useAnimatedStyle(() => {
    const style: { transform: { translateX: number }[]; opacity?: number } = {
      transform: [{ translateX: translateX.value }],
    };
    if (withOpacity) {
      style.opacity = opacity.value;
    }
    return style;
  });

  const triggerSlide = useCallback(
    (direction: SlideDirection, onComplete?: () => void) => {
      'worklet';
      // Guard: disabled mode
      if (disabled) {
        if (onComplete) {
          // Store callback and execute via RN-runtime wrapper
          onCompleteRef.current = onComplete;
          scheduleOnRN(executeOnComplete);
        }
        return;
      }

      // Guard: direction constraints
      if (allowedDirections === 'right' && direction === -1) return;
      if (allowedDirections === 'left' && direction === 1) return;

      // Guard: prevent double-tap / re-entry while animating
      if (isAnimatingShared.value) return;

      isAnimatingShared.value = true;

      // Store callback before animation starts
      if (onComplete) {
        onCompleteRef.current = onComplete;
      }

      scheduleOnRN(updateAnimatingState, true);

      const animationEasing = easing ?? defaultEasing;
      const timingConfig = { duration, easing: animationEasing };

      // Animate opacity if enabled
      if (withOpacity) {
        opacity.value = withTiming(opacityTarget, timingConfig);
      }

      translateX.value = withTiming(
        direction * slideDistance,
        timingConfig,
        finished => {
          isAnimatingShared.value = false;
          scheduleOnRN(updateAnimatingState, false);
          if (finished && onComplete) {
            scheduleOnRN(executeOnComplete);
          }
        },
      );
    },
    [
      duration,
      slideDistance,
      translateX,
      opacity,
      isAnimatingShared,
      easing,
      withOpacity,
      opacityTarget,
      allowedDirections,
      disabled,
      updateAnimatingState,
      executeOnComplete,
    ],
  );

  const resetSlide = useCallback(() => {
    'worklet';
    cancelAnimation(translateX);
    cancelAnimation(opacity);
    translateX.value = withTiming(0, { duration: duration / 2, easing: defaultEasing });
    if (withOpacity) {
      opacity.value = withTiming(1, { duration: duration / 2, easing: defaultEasing });
    }
    isAnimatingShared.value = false;
    scheduleOnRN(updateAnimatingState, false);
  }, [translateX, opacity, isAnimatingShared, duration, withOpacity, updateAnimatingState]);

  return { animatedSlideStyle, triggerSlide, resetSlide, isAnimating };
}
