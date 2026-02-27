import { useState } from 'react';
import { useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type {
  UseAnimatedPresenceProps,
  UseAnimatedPresenceReturn,
  SpringConfig } from './types';

const DEFAULT_SPRING: SpringConfig = { mass: 0.4, damping: 15, stiffness: 150 };

export function useAnimatedPresence(
  props: UseAnimatedPresenceProps = {},
): UseAnimatedPresenceReturn {
  const {
    springConfig = DEFAULT_SPRING,
    callbacks = {},
    initialVisible = false } = props;

  // Destructure callbacks for granular memoization dependencies
  const { onOpenStart, onOpenComplete, onCloseStart, onCloseComplete } =
    callbacks;

  const [shouldRender, setShouldRender] = useState(initialVisible);
  const isVisible = useSharedValue(initialVisible);
  const progress = useSharedValue(initialVisible ? 1 : 0);

  const open = () => {
    'worklet';
    if (isVisible.value) return;

    isVisible.value = true;
    scheduleOnRN(setShouldRender, true);
    if (onOpenStart) scheduleOnRN(onOpenStart);

    progress.value = withSpring(1, springConfig, finished => {
      'worklet';
      if (finished) {
        if (onOpenComplete) scheduleOnRN(onOpenComplete);
      }
    });
  };

  const close = () => {
    'worklet';
    if (!isVisible.value) return;

    isVisible.value = false;
    if (onCloseStart) scheduleOnRN(onCloseStart);

    progress.value = withSpring(0, springConfig, finished => {
      'worklet';
      if (finished) {
        scheduleOnRN(setShouldRender, false);
        if (onCloseComplete) scheduleOnRN(onCloseComplete);
      }
    });
  };

  const toggle = () => {
    'worklet';
    if (isVisible.value) {
      close();
    } else {
      open();
    }
  };

  const isActive = () => isVisible.value;

  return { shouldRender, isVisible, progress, open, close, toggle, isActive };
}
