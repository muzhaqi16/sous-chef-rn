import React, { useState, ReactNode, useEffect } from 'react';

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { usePanGesture, GestureDetector } from 'react-native-gesture-handler';
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
  /**
   * How long to hold before dismissing, in ms. Defaults to
   * `TOAST.AUTO_DISMISS_SHORT`; `TOAST.AUTO_DISMISS_LONG` is the preset for
   * toasts carrying a sentence. Any positive value works — prefer a preset so
   * the timings stay tunable in one place.
   *
   * The hold spans the fade-in and excludes the fade-out, so time on screen is
   * roughly `duration + TIMING.STANDARD`.
   */
  duration?: number;
  type?: ToastType;
  action?: { label: string; onPress: () => void };
  /**
   * Marks a toast as a *state announcement* — the latest one is the only one
   * still true, so it replaces a displayed or queued announcement instead of
   * waiting in line behind it (offline → back-online being the case that
   * matters: queueing meant the second toggle's toast only surfaced once the
   * first had run its full duration, long after the state it described).
   *
   * Only announcements supersede each other, and never one carrying an
   * `action` — an actionable toast is never silently dropped.
   */
  supersede?: boolean;
}
export type ToastFn = (options: ToastOptions) => void;

const TOAST_ICONS: Partial<
  Record<ToastType, React.ComponentProps<typeof Ionicons>['name']>
> = {
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
  // Bumped every time a toast becomes current. A dismissal carries the
  // generation it started on so it can only clear that toast — see
  // onDismissComplete.
  generation: number;
};

type DismissTargets = {
  translateY: SharedValue<number>;
  translateX: SharedValue<number>;
  opacity: SharedValue<number>;
};

/**
 * Module scope so its identity is constant: the entry effect arms the
 * auto-dismiss timer with it, and a per-render function there would re-arm the
 * timer on every render and the toast would never leave.
 *
 * Idempotent — safe to call mid-animation.
 */
const animateDismiss = (
  targets: DismissTargets,
  dismissedGeneration: number,
  setQueue: React.Dispatch<React.SetStateAction<ToastQueueState>>,
) => {
  const { translateY, translateX, opacity } = targets;
  // The spring's completion hops to the JS thread a frame later. A toast
  // arriving in that gap is already on screen by the time this lands, so
  // clearing unconditionally would blank it mid-display.
  const onDismissComplete = () => {
    setQueue(prev =>
      prev.generation === dismissedGeneration
        ? { ...prev, current: null }
        : prev,
    );
  };
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

const sameType = (a: ToastOptions, b: ToastOptions) =>
  (a.type ?? 'default') === (b.type ?? 'default');

/** Both are state announcements, so the newer one obsoletes the older. */
const supersedes = (older: ToastOptions, newer: ToastOptions) =>
  older.supersede === true && newer.supersede === true;

export const ToastProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const insets = useSafeAreaInsets();

  // Updater pattern lets two synchronous showToast() calls coordinate — the
  // second updater sees the first's result, no need for refs.
  const [{ current, queue, generation }, setQueue] = useState<ToastQueueState>({
    current: null,
    queue: [],
    generation: 0,
  });

  // The container never unmounts, so it has to keep rendering the outgoing
  // toast's message and colors while it animates away. Rendering it with a
  // null toast drops the type variant and falls back to the base background,
  // which is near-white in the dark theme.
  const [displayed, setDisplayed] = useState<ToastOptions | null>(null);
  if (current && current !== displayed) setDisplayed(current);

  const translateY = useSharedValue(TOAST.OFFSCREEN_Y);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0);
  // Mirrors `generation` for the gesture worklet, which can't read state.
  const currentGeneration = useSharedValue(0);

  // Defined in RN scope so the gesture worklet can hand it to scheduleOnRN
  // with a primitive argument only.
  const dismissGeneration = (dismissedGeneration: number) => {
    animateDismiss(
      { translateY, translateX, opacity },
      dismissedGeneration,
      setQueue,
    );
  };

  const showToast: ToastFn = opts => {
    setQueue(prev => {
      if (!prev.current)
        return { ...prev, current: opts, generation: prev.generation + 1 };
      // Replace in-place when nothing has an action and either the type matches
      // (coalesces rapid same-type calls into one toast that ends N seconds
      // after the *last* call, instead of a sequential parade) or both are state
      // announcements (the newer state is the only true one).
      const canReplace =
        prev.current.action == null &&
        opts.action == null &&
        (sameType(prev.current, opts) || supersedes(prev.current, opts));
      if (canReplace) {
        return {
          current: { ...opts, action: undefined },
          queue: prev.queue.filter(
            q =>
              q.action != null || !(sameType(q, opts) || supersedes(q, opts)),
          ),
          generation: prev.generation + 1,
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
  //
  // The resting position (`insets.top` + `marginTop`) is LAYOUT; translateY is
  // relative to it and rests at 0. Two reasons the safe-area offset isn't in
  // the spring target: a target captured on the frame the toast appears can't
  // follow an inset that resolves or changes later, and entering from
  // OFFSCREEN_Y made every appearance sweep ~290pt, so its first frames sat
  // under the status bar / Dynamic Island — screenshotted mid-flight it reads
  // as a clipped banner. ENTER_FROM_Y keeps the slide short.
  useEffect(() => {
    if (!current) return;
    currentGeneration.set(generation);
    if (translateY.get() < TOAST.ENTER_FROM_Y) {
      translateY.set(TOAST.ENTER_FROM_Y);
    }
    translateY.set(withSpring(0, SPRING.TOAST_ENTER));
    translateX.set(0);
    opacity.set(withTiming(1, { duration: TIMING.FAST }));
    // Any positive duration is honoured. This used to compare against
    // AUTO_DISMISS_LONG for equality, which made `duration` a flag with one
    // recognized value — `duration: 800` silently held for AUTO_DISMISS_SHORT.
    const requested = current.duration;
    const ms =
      typeof requested === 'number' && requested > 0
        ? requested
        : TOAST.AUTO_DISMISS_SHORT;
    const id = setTimeout(
      () =>
        animateDismiss(
          { translateY, translateX, opacity },
          generation,
          setQueue,
        ),
      ms,
    );
    return () => clearTimeout(id);
  }, [current, generation, currentGeneration, opacity, translateX, translateY]);

  // After dismissal, give it a beat before popping the next queued toast.
  useEffect(() => {
    if (current || queue.length === 0) return;
    const id = setTimeout(() => {
      setQueue(prev => {
        if (prev.current || prev.queue.length === 0) return prev;
        const [next, ...rest] = prev.queue;
        return { current: next, queue: rest, generation: prev.generation + 1 };
      });
    }, TOAST.QUEUE_DELAY);
    return () => clearTimeout(id);
  }, [current, queue.length]);

  const panGesture = usePanGesture({
    minDistance: 10,
    onUpdate: event => {
      'worklet';
      // Drag up only — the toast rests at its laid-out position (translateY 0).
      if (event.translationY < 0) {
        translateY.set(event.translationY);
      }
      translateX.set(event.translationX);
    },
    onDeactivate: event => {
      'worklet';
      const shouldDismiss =
        event.translationY < -TOAST.SWIPE_THRESHOLD ||
        Math.abs(event.translationX) > TOAST.SWIPE_THRESHOLD;
      if (shouldDismiss) {
        scheduleOnRN(dismissGeneration, currentGeneration.get());
      } else {
        translateY.set(withSpring(0, SPRING.TOAST_ENTER));
        translateX.set(withSpring(0, SPRING.TOAST_ENTER));
      }
    },
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
      dismissGeneration(generation);
    }
  };

  const type = displayed?.type ?? 'default';
  const iconName = TOAST_ICONS[type];
  styles.useVariants({ type: type === 'default' ? undefined : type });

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          testID={`toast-${type}`}
          pointerEvents={current ? 'auto' : 'none'}
          // Safe-area offset applied as layout, not animation — see the entry
          // effect. `marginTop` (spacing.md) is the gap below it.
          style={[styles.toastContainer, { top: insets.top }, animatedStyle]}
        >
          {iconName ? (
            <ThemedToastIcon
              name={iconName}
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
            {displayed?.message}
          </Text>
          {displayed?.action ? (
            <Pressable onPress={handleActionPress} style={styles.actionButton}>
              <Text style={styles.actionText}>{displayed.action.label}</Text>
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
    // `top` is set at the call site from the safe-area inset; this is the gap
    // between the status bar and the toast.
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing['3'],
    borderRadius: theme.radii.lg,
    borderCurve: 'continuous',
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
