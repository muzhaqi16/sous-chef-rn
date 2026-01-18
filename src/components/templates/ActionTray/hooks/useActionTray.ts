import { useCallback } from 'react';
import { useSharedValue, withSpring } from 'react-native-reanimated';
import { useAnimatedPresence } from '#/hooks/animations';
import type { UseActionTrayProps, UseActionTrayReturn } from '../types';

const SPRING_CONFIG = { mass: 0.4, damping: 15, stiffness: 150 };

export const useActionTray = ({
  maxHeight,
  onClose,
  onOpen,
}: UseActionTrayProps): UseActionTrayReturn => {
  const presence = useAnimatedPresence({
    springConfig: SPRING_CONFIG,
    callbacks: {
      onOpenStart: onOpen,
      onCloseComplete: onClose,
    },
  });

  // Keep translateY separate for gesture compatibility
  const translateY = useSharedValue(maxHeight);

  const scrollTo = useCallback(
    (destination: number) => {
      'worklet';
      translateY.value = withSpring(destination, SPRING_CONFIG);

      if (destination === 0) {
        presence.open();
      } else if (destination === maxHeight) {
        presence.close();
      }
    },
    [maxHeight, translateY, presence],
  );

  const open = useCallback(() => {
    'worklet';
    scrollTo(0);
  }, [scrollTo]);

  const close = useCallback(() => {
    'worklet';
    scrollTo(maxHeight);
  }, [scrollTo, maxHeight]);

  return {
    translateY,
    active: presence.isVisible,
    touchable: presence.shouldRender,
    scrollTo,
    open,
    close,
    isActive: presence.isActive,
    toggle: presence.toggle,
  };
};
