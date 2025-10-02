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
    active.value = destination !== maxHeight;

    translateY.value = withSpring(destination, {
      mass: 0.4,
      damping: 15,
      stiffness: 150,
    });
  }, [maxHeight]);

  const open = useCallback(() => {
    'worklet';
    if (onOpen) {
      scheduleOnRN(onOpen);
    }
    scrollTo(0);
  }, [scrollTo, onOpen]);

  const close = useCallback(() => {
    'worklet';
    if (onClose) {
      scheduleOnRN(onClose);
    }
    scrollTo(maxHeight);
  }, [maxHeight, scrollTo, onClose]);

  const isActive = useCallback(() => {
    return active.value;
  }, []);

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