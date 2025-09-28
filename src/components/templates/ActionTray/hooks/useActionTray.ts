import { useCallback } from 'react';
import { useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { UseActionTrayProps, UseActionTrayReturn } from '../types';

export const useActionTray = ({
  maxHeight,
  onClose,
  onOpen,
}: UseActionTrayProps): UseActionTrayReturn => {
  const translateY = useSharedValue(maxHeight);
  const active = useSharedValue(false);

  const scrollTo = useCallback((destination: number) => {
    'worklet';
    const wasActive = active.value;
    active.value = destination !== maxHeight;

    translateY.value = withSpring(destination, {
      mass: 0.4,
      damping: 15,
      stiffness: 150,
    });

    // Tab bar visibility is now handled in ActionTray component

    // Handle user callbacks
    if (!wasActive && active.value && onOpen) {
      scheduleOnRN(onOpen);
    } else if (wasActive && !active.value && onClose) {
      scheduleOnRN(onClose);
    }
  }, [maxHeight, onClose, onOpen, active, translateY]);

  const open = useCallback(() => {
    'worklet';
    scrollTo(0);
  }, [scrollTo]);

  const close = useCallback(() => {
    'worklet';
    scrollTo(maxHeight);
  }, [maxHeight, scrollTo]);

  const isActive = useCallback(() => {
    return active.value;
  }, [active]);

  const toggle = useCallback(() => {
    'worklet';
    if (active.value) {
      close();
    } else {
      open();
    }
  }, [active, close, open]);

  return {
    translateY,
    active,
    scrollTo,
    open,
    close,
    isActive,
    toggle,
  };
};