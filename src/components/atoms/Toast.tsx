import React, { useState, useRef, ReactNode, useEffect } from 'react';

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
  Pressable,
} from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { ToastContext } from '../../hooks/useToast';
import { toastService } from '#/services/toastService';
import { SPRING, TIMING, TOAST } from '#/constants/animations';
import { Text } from '#components/atoms/Text';

export type ToastType = 'default' | 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  message: string;
  duration?: number;
  type?: ToastType;
  action?: { label: string; onPress: () => void };
}
export type ToastFn = (options: ToastOptions) => void;

const TOAST_ICONS: Partial<Record<ToastType, string>> = {
  success: 'checkmark-circle',
  error: 'close-circle',
  warning: 'alert-circle-outline',
  info: 'information-circle-outline',
};

type ToastQueueState = {
  current: ToastOptions | null;
  queue: ToastOptions[];
};

const sameType = (a: ToastOptions, b: ToastOptions) =>
  (a.type ?? 'default') === (b.type ?? 'default');

export const ToastProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const insets = useSafeAreaInsets();
  const { theme } = useUnistyles();

  // Single source of truth. The setState updater pattern lets two synchronous
  // showToast() calls coordinate (the second updater sees the first's result),
  // which is what the old isShowing/currentType/queue refs were faking.
  const [{ current, queue }, setQueue] = useState<ToastQueueState>({
    current: null,
    queue: [],
  });

  // toastService.init registers a stable bridge once; this ref keeps it
  // pointing at the latest showToast closure. The dismiss ref serves the
  // setTimeout below the same way — `() => dismissRef.current()` is a stable
  // setTimeout callback that always dispatches the latest animateDismiss,
  // which keeps the auto-dismiss effect's deps to just `[current]`.
  const showToastRef = useRef<ToastFn | null>(null);
  const dismissRef = useRef<() => void>(() => {});

  const translateY = useSharedValue(TOAST.OFFSCREEN_Y);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0);

  // Bounce off state — useEffect on `current` does the rest. No ref reads here
  // is what keeps the gesture's onEnd closure clean of `react-hooks/refs`.
  const onDismissComplete = () => {
    setQueue(prev => ({ ...prev, current: null }));
  };

  // Idempotent — safe to call mid-animation.
  const animateDismiss = () => {
    translateY.set(
      withSpring(TOAST.OFFSCREEN_Y, SPRING.TOAST_DISMISS, finished => {
        'worklet';
        if (finished) {
          translateX.set(0);
          scheduleOnRN(onDismissComplete);
        }
      }),
    );
    opacity.set(withTiming(0, { duration: TIMING.STANDARD }));
  };

  const showToast: ToastFn = opts => {
    setQueue(prev => {
      if (!prev.current) {
        return { ...prev, current: opts };
      }
      // Replace in-place when nothing has an action and the type matches —
      // swap the message without an animation cycle, drop redundant queued
      // entries of the same kind.
      const canReplace =
        prev.current.action == null &&
        opts.action == null &&
        sameType(prev.current, opts);
      if (canReplace) {
        return {
          current: { ...opts, action: undefined },
          queue: prev.queue.filter(q => q.action != null || !sameType(q, opts)),
        };
      }
      return { ...prev, queue: [...prev.queue, opts] };
    });
  };

  // Keep ref-callbacks pointing to the latest closures. Writing in an effect
  // (not during render) is what allows the setTimeout in the auto-dismiss
  // effect to close over a stable reference and depend only on `[current]`.
  useEffect(() => {
    showToastRef.current = showToast;
    dismissRef.current = animateDismiss;
  });

  // One-time wiring of the imperative toastService → showToast.
  useEffect(() => {
    toastService.init((message, type, options) => {
      showToastRef.current?.({ message, type: type ?? 'default', ...options });
    });
  }, []);

  // Animate in / re-position. Re-runs on rotation (insets change) without
  // touching the auto-dismiss timer. Re-running on in-place replace re-targets
  // SharedValues at their current value — Reanimated treats that as a no-op,
  // so there's no visual flicker.
  useEffect(() => {
    if (!current) return;
    translateY.set(withSpring(insets.top + 16, SPRING.TOAST_ENTER));
    translateX.set(0);
    opacity.set(withTiming(1, { duration: TIMING.FAST }));
  }, [current, insets.top, opacity, translateX, translateY]);

  // Auto-dismiss timer. Cleanup cancels on replace, gesture-dismiss, unmount.
  // Replacing a same-type toast (no action) creates a new `current` reference,
  // so this effect re-runs and resets the timer — that's the spam-coalescing
  // behavior: rapid same-type calls show one toast that ends N seconds after
  // the *last* call.
  useEffect(() => {
    if (!current) return;
    const ms =
      current.duration === TOAST.AUTO_DISMISS_LONG
        ? TOAST.AUTO_DISMISS_LONG
        : TOAST.AUTO_DISMISS_SHORT;
    const id = setTimeout(() => dismissRef.current(), ms);
    return () => clearTimeout(id);
  }, [current]);

  // Once the active toast is gone, give it a beat and pop the next one.
  useEffect(() => {
    if (current || queue.length === 0) return;
    const id = setTimeout(() => {
      setQueue(prev => {
        if (prev.current || prev.queue.length === 0) return prev;
        const [next, ...rest] = prev.queue;
        return { current: next, queue: rest };
      });
    }, TOAST.QUEUE_DELAY);
    return () => clearTimeout(id);
  }, [current, queue.length]);

  // Swipe-to-dismiss
  const dismissFromGesture = () => {
    animateDismiss();
  };

  const panGesture = Gesture.Pan()
    .minDistance(10)
    .onUpdate(event => {
      if (event.translationY < 0) {
        translateY.set(insets.top + 16 + event.translationY);
      }
      translateX.set(event.translationX);
    })
    .onEnd(event => {
      const shouldDismiss =
        event.translationY < -TOAST.SWIPE_THRESHOLD ||
        Math.abs(event.translationX) > TOAST.SWIPE_THRESHOLD;
      if (shouldDismiss) {
        scheduleOnRN(dismissFromGesture);
      } else {
        translateY.set(withSpring(insets.top + 16, SPRING.TOAST_ENTER));
        translateX.set(withSpring(0, SPRING.TOAST_ENTER));
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.get() },
      { translateX: translateX.get() },
    ],
    opacity: opacity.get(),
  }));

  const handleActionPress = () => {
    if (current?.action) {
      current.action.onPress();
      animateDismiss();
    }
  };

  const type = current?.type ?? 'default';
  const iconName = TOAST_ICONS[type];
  styles.useVariants({ type: type === 'default' ? undefined : type });
  const toastIconColor =
    type !== 'default' && type in theme.colors.alertBanner
      ? theme.colors.alertBanner[type as keyof typeof theme.colors.alertBanner]
          .text
      : theme.colors.textInverse;

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          testID={`toast-${type}`}
          pointerEvents={current ? 'auto' : 'box-none'}
          style={[styles.toastContainer, animatedStyle]}
        >
          {iconName ? (
            <Ionicons
              name={iconName as any}
              size={18}
              color={toastIconColor}
              style={styles.icon}
            />
          ) : null}
          <Text
            style={styles.toastText}
            testID="toast-message"
            numberOfLines={2}
          >
            {current?.message}
          </Text>
          {current?.action ? (
            <Pressable onPress={handleActionPress} style={styles.actionButton}>
              <Text style={styles.actionText}>{current.action.label}</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      </GestureDetector>
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create(theme => ({
  toastContainer: {
    position: 'absolute',
    left: theme.spacing.md,
    right: theme.spacing.md,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing['3'],
    borderRadius: theme.radii.lg,
    zIndex: theme.zIndex.toast,
    ...theme.shadows.md,
    backgroundColor: theme.colors.textPrimary,
    variants: {
      type: {
        success: {
          backgroundColor: theme.colors.alertBanner.success.bg,
          borderWidth: 1,
          borderColor: theme.colors.alertBanner.success.border,
        },
        error: {
          backgroundColor: theme.colors.alertBanner.error.bg,
          borderWidth: 1,
          borderColor: theme.colors.alertBanner.error.border,
        },
        warning: {
          backgroundColor: theme.colors.alertBanner.warning.bg,
          borderWidth: 1,
          borderColor: theme.colors.alertBanner.warning.border,
        },
        info: {
          backgroundColor: theme.colors.alertBanner.info.bg,
          borderWidth: 1,
          borderColor: theme.colors.alertBanner.info.border,
        },
      },
    },
  },
  icon: {
    marginRight: theme.spacing.xs,
  },
  toastText: {
    flex: 1,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textInverse,
    variants: {
      type: {
        success: { color: theme.colors.alertBanner.success.text },
        error: { color: theme.colors.alertBanner.error.text },
        warning: { color: theme.colors.alertBanner.warning.text },
        info: { color: theme.colors.alertBanner.info.text },
      },
    },
  },
  actionButton: {
    marginLeft: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  },
  actionText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.fonts.weight.bold,
    textDecorationLine: 'underline',
    color: theme.colors.textInverse,
    variants: {
      type: {
        success: { color: theme.colors.alertBanner.success.text },
        error: { color: theme.colors.alertBanner.error.text },
        warning: { color: theme.colors.alertBanner.warning.text },
        info: { color: theme.colors.alertBanner.info.text },
      },
    },
  },
}));
