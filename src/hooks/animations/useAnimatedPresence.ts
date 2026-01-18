import { useCallback, useState } from 'react';
import { useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type {
  UseAnimatedPresenceProps,
  UseAnimatedPresenceReturn,
  SpringConfig,
} from './types';

const DEFAULT_SPRING: SpringConfig = { mass: 0.4, damping: 15, stiffness: 150 };

export function useAnimatedPresence(
  props: UseAnimatedPresenceProps = {},
): UseAnimatedPresenceReturn {
  const {
    springConfig = DEFAULT_SPRING,
    callbacks = {},
    initialVisible = false,
  } = props;

  // Destructure callbacks for granular memoization dependencies
  const { onOpenStart, onOpenComplete, onCloseStart, onCloseComplete } =
    callbacks;

  const [shouldRender, setShouldRender] = useState(initialVisible);
  const isVisible = useSharedValue(initialVisible);
  const progress = useSharedValue(initialVisible ? 1 : 0);

  // Create stable function references for scheduleOnRN
  // These run on the JS thread and can safely access callbacks
  const setRenderTrue = useCallback(() => setShouldRender(true), []);
  const setRenderFalse = useCallback(() => setShouldRender(false), []);

  const handleOpenStart = useCallback(() => {
    onOpenStart?.();
  }, [onOpenStart]);

  const handleOpenComplete = useCallback(() => {
    onOpenComplete?.();
  }, [onOpenComplete]);

  const handleCloseStart = useCallback(() => {
    onCloseStart?.();
  }, [onCloseStart]);

  const handleCloseComplete = useCallback(() => {
    onCloseComplete?.();
  }, [onCloseComplete]);

  const open = useCallback(() => {
    'worklet';
    if (isVisible.value) return;

    isVisible.value = true;
    scheduleOnRN(setRenderTrue);
    scheduleOnRN(handleOpenStart);

    progress.value = withSpring(1, springConfig, finished => {
      'worklet';
      if (finished) {
        scheduleOnRN(handleOpenComplete);
      }
    });
  }, [isVisible, progress, springConfig, setRenderTrue, handleOpenStart, handleOpenComplete]);

  const close = useCallback(() => {
    'worklet';
    if (!isVisible.value) return;

    isVisible.value = false;
    scheduleOnRN(handleCloseStart);

    progress.value = withSpring(0, springConfig, finished => {
      'worklet';
      if (finished) {
        scheduleOnRN(setRenderFalse);
        scheduleOnRN(handleCloseComplete);
      }
    });
  }, [isVisible, progress, springConfig, handleCloseStart, setRenderFalse, handleCloseComplete]);

  const toggle = useCallback(() => {
    'worklet';
    if (isVisible.value) {
      close();
    } else {
      open();
    }
  }, [isVisible, open, close]);

  const isActive = useCallback(() => isVisible.value, [isVisible]);

  return { shouldRender, isVisible, progress, open, close, toggle, isActive };
}
