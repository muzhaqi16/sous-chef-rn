import React, { useState, useRef, ReactNode, useEffect } from 'react';
import { Pressable, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { StyleSheet } from 'react-native-unistyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { ToastContext } from '../../hooks/useToast';
import { toastService } from '#/services/toastService';
import { SPRING, TIMING, TOAST } from '#/constants/animations';

// Define toast types
export type ToastType = 'default' | 'success' | 'error' | 'warning' | 'info';

// Options for showing a toast
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

export const ToastProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const insets = useSafeAreaInsets();

  const [toastState, setToastState] = useState<{
    message: string;
    type: ToastType;
    action?: { label: string; onPress: () => void };
  } | null>(null);

  const isShowingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueRef = useRef<ToastOptions[]>([]);

  const showToastRef = useRef<ToastFn | null>(null);

  const translateY = useSharedValue(TOAST.OFFSCREEN_Y);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0);

  // Pre-defined RN-scope callbacks for scheduleOnRN (CLAUDE.md convention)
  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const clearContent = () => {
    setToastState(null);
    isShowingRef.current = false;
  };

  const processQueue = () => {
    const next = queueRef.current.shift();
    if (next) {
      setTimeout(() => {
        presentToast(next);
      }, TOAST.QUEUE_DELAY);
    }
  };

  const onDismissComplete = () => {
    clearContent();
    processQueue();
  };

  const presentToast = (opts: ToastOptions) => {
    const { message, type = 'default', action } = opts;
    isShowingRef.current = true;
    setToastState({ message, type, action });

    const targetY = insets.top + 16;
    translateY.set(withSpring(targetY, SPRING.TOAST_ENTER));
    translateX.set(0);
    opacity.set(withTiming(1, { duration: TIMING.FAST }));

    // Auto-dismiss
    clearTimer();
    const timeout =
      opts.duration === TOAST.AUTO_DISMISS_LONG
        ? TOAST.AUTO_DISMISS_LONG
        : TOAST.AUTO_DISMISS_SHORT;
    timerRef.current = setTimeout(() => {
      animateDismiss();
    }, timeout);
  };

  const animateDismiss = () => {
    clearTimer();
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
    if (isShowingRef.current) {
      queueRef.current.push(opts);
      return;
    }
    presentToast(opts);
  };

  // Keep ref in sync (written in effect, not during render — per CLAUDE.md)
  useEffect(() => {
    showToastRef.current = showToast;
  });

  // Initialize toast service bridge
  useEffect(() => {
    toastService.init((message, type, options) => {
      showToastRef.current?.({ message, type: type ?? 'default', ...options });
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, []);

  // Swipe-to-dismiss gesture
  const dismissFromGesture = () => {
    animateDismiss();
  };

  const panGesture = Gesture.Pan()
    .onUpdate(event => {
      'worklet';
      // Allow upward swipe (negative Y) for top-positioned toast
      if (event.translationY < 0) {
        translateY.set(insets.top + 16 + event.translationY);
      }
      // Allow horizontal swipe
      translateX.set(event.translationX);
    })
    .onEnd(event => {
      'worklet';
      const shouldDismiss =
        event.translationY < -TOAST.SWIPE_THRESHOLD ||
        Math.abs(event.translationX) > TOAST.SWIPE_THRESHOLD;

      if (shouldDismiss) {
        scheduleOnRN(dismissFromGesture);
      } else {
        // Spring back
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
    if (toastState?.action) {
      toastState.action.onPress();
      animateDismiss();
    }
  };

  const type = toastState?.type ?? 'default';
  const iconName = TOAST_ICONS[type];
  const bgStyle =
    type === 'success'
      ? styles.bg_success
      : type === 'error'
      ? styles.bg_error
      : type === 'warning'
      ? styles.bg_warning
      : type === 'info'
      ? styles.bg_info
      : styles.bg_default;

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          testID={`toast-${type}`}
          pointerEvents={toastState ? 'auto' : 'box-none'}
          style={[styles.toastContainer, bgStyle, animatedStyle]}
        >
          {iconName ? (
            <Ionicons
              name={iconName as any}
              size={18}
              color="#fff"
              style={styles.icon}
            />
          ) : null}
          <Text
            style={styles.toastText}
            testID="toast-message"
            numberOfLines={2}
          >
            {toastState?.message}
          </Text>
          {toastState?.action ? (
            <Pressable onPress={handleActionPress} style={styles.actionButton}>
              <Text style={styles.actionText}>{toastState.action.label}</Text>
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
  },
  bg_default: { backgroundColor: theme.colors.textPrimary },
  bg_success: { backgroundColor: theme.colors.success },
  bg_error: { backgroundColor: theme.colors.error },
  bg_warning: { backgroundColor: theme.colors.warning },
  bg_info: { backgroundColor: theme.colors.info },
  icon: {
    marginRight: theme.spacing.xs,
  },
  toastText: {
    flex: 1,
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.fonts.weight.medium,
  },
  actionButton: {
    marginLeft: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  },
  actionText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.fonts.weight.bold,
    textDecorationLine: 'underline',
  },
}));
