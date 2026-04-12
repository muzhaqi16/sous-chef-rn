import { useEffect, useRef, useState } from 'react';
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

  // Store callbacks in refs so the worklet boundary only ever sees stable
  // RN-scope wrapper functions. Per CLAUDE.md, function references cannot be
  // serialized across `scheduleOnRN` — they arrive as plain objects in release
  // mode and crash with `TypeError: Object is not a function`. By going through
  // refs we keep the callsite a primitive function reference defined in RN
  // scope, while still allowing the caller to pass inline closures that change
  // each render.
  const onOpenStartRef = useRef(onOpenStart);
  const onOpenCompleteRef = useRef(onOpenComplete);
  const onCloseStartRef = useRef(onCloseStart);
  const onCloseCompleteRef = useRef(onCloseComplete);

  useEffect(() => {
    onOpenStartRef.current = onOpenStart;
  }, [onOpenStart]);
  useEffect(() => {
    onOpenCompleteRef.current = onOpenComplete;
  }, [onOpenComplete]);
  useEffect(() => {
    onCloseStartRef.current = onCloseStart;
  }, [onCloseStart]);
  useEffect(() => {
    onCloseCompleteRef.current = onCloseComplete;
  }, [onCloseComplete]);

  const [shouldRender, setShouldRender] = useState(initialVisible);
  const isVisible = useSharedValue(initialVisible);
  const progress = useSharedValue(initialVisible ? 1 : 0);

  // Stable RN-scope wrapper functions — these are what `scheduleOnRN` actually
  // sees. They read from refs at call time, so the latest callback prop wins.
  const triggerOpenStart = () => {
    onOpenStartRef.current?.();
  };
  const triggerOpenComplete = () => {
    onOpenCompleteRef.current?.();
  };
  const triggerCloseStart = () => {
    onCloseStartRef.current?.();
  };
  const triggerCloseComplete = () => {
    onCloseCompleteRef.current?.();
  };

  const open = () => {
    'worklet';
    if (isVisible.get()) return;

    isVisible.set(true);
    scheduleOnRN(setShouldRender, true);
    scheduleOnRN(triggerOpenStart);

    progress.set(
      withSpring(1, springConfig, finished => {
        'worklet';
        if (finished) {
          scheduleOnRN(triggerOpenComplete);
        }
      }),
    );
  };

  const close = () => {
    'worklet';
    if (!isVisible.get()) return;

    isVisible.set(false);
    scheduleOnRN(triggerCloseStart);

    progress.set(
      withSpring(0, springConfig, finished => {
        'worklet';
        if (finished) {
          scheduleOnRN(setShouldRender, false);
          scheduleOnRN(triggerCloseComplete);
        }
      }),
    );
  };

  const toggle = () => {
    'worklet';
    if (isVisible.get()) {
      close();
    } else {
      open();
    }
  };

  const isActive = () => isVisible.get();

  return { shouldRender, isVisible, progress, open, close, toggle, isActive };
}
