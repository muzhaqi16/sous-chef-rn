import React, { useState, ReactNode, useEffect } from 'react';

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Pressable } from '#components/atoms/themedComponents';
import { scheduleOnRN } from 'react-native-worklets';
import { StyleSheet, withUnistyles } from 'react-native-unistyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { ToastContext } from '../../hooks/useToast';
import { _setToastDispatch } from '#/services/toastService';
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

// Theme-reactive Ionicons. uniProps captures the runtime `type` from the
// surrounding closure (per-render mapper) and resolves the matching alert
// banner color, falling back to textInverse.
const ThemedToastIcon = withUnistyles(Ionicons);

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

  // Updater pattern lets two synchronous showToast() calls coordinate — the
  // second updater sees the first's result, no need for refs.
  const [{ current, queue }, setQueue] = useState<ToastQueueState>({
    current: null,
    queue: [],
  });

  const translateY = useSharedValue(TOAST.OFFSCREEN_Y);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0);

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
      if (!prev.current) return { ...prev, current: opts };
      // Replace in-place when nothing has an action and the type matches —
      // coalesces rapid same-type calls into one toast that ends N seconds
      // after the *last* call (instead of a sequential parade).
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

  // Imperative bridge for non-React-tree callers (toastService).
  useEffect(() => {
    _setToastDispatch(showToast);
  });

  // Animate in + arm auto-dismiss whenever a toast becomes current. Cleanup
  // cancels the timer on replace, gesture-dismiss, unmount. Re-running on
  // in-place replace re-targets SharedValues at their current value (no-op
  // visually) and resets the timer — the spam-coalescing behavior.
  useEffect(() => {
    if (!current) return;
    translateY.set(withSpring(insets.top + 16, SPRING.TOAST_ENTER));
    translateX.set(0);
    opacity.set(withTiming(1, { duration: TIMING.FAST }));
    const ms =
      current.duration === TOAST.AUTO_DISMISS_LONG
        ? TOAST.AUTO_DISMISS_LONG
        : TOAST.AUTO_DISMISS_SHORT;
    const id = setTimeout(animateDismiss, ms);
    return () => clearTimeout(id);
  }, [current]);

  // After dismissal, give it a beat before popping the next queued toast.
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
        scheduleOnRN(animateDismiss);
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
            <ThemedToastIcon
              name={iconName as any}
              size={18}
              style={styles.icon}
              uniProps={t => ({
                color:
                  type !== 'default' && type in t.colors.alertBanner
                    ? t.colors.alertBanner[
                        type as keyof typeof t.colors.alertBanner
                      ].text
                    : t.colors.textInverse,
              })}
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
