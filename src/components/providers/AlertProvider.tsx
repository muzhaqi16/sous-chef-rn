import React, { useState, useEffect, useRef } from 'react';
import { Modal, View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { StyleSheet } from 'react-native-unistyles';
import {
  alertService,
  type AlertEntry,
  type AlertButton,
} from '#/services/alertService';
import { SPRING, TIMING, ALERT } from '#/constants/animations';
import { Text } from '#components/atoms/Text';

interface AlertCardProps {
  entry: AlertEntry;
  stackIndex: number;
  onDismiss: (id: number) => void;
}

const AlertCard: React.FC<AlertCardProps> = ({
  entry,
  stackIndex,
  onDismiss,
}) => {
  const scale = useSharedValue(ALERT.ENTER_SCALE_FROM);
  const opacity = useSharedValue(0);
  const dismissing = useRef(false);

  // Closure: a function argument serializes to an object across the worklet boundary.
  const handleDismissEntry = () => {
    onDismiss(entry.id);
  };

  useEffect(() => {
    scale.set(withSpring(1, SPRING.GENTLE));
    opacity.set(withTiming(1, { duration: TIMING.STANDARD }));
  }, [scale, opacity]);

  const handleButtonPress = (button: AlertButton) => {
    if (dismissing.current) return;
    dismissing.current = true;

    button.onPress?.();

    scale.set(
      withTiming(ALERT.EXIT_SCALE_TO, { duration: TIMING.FAST }, finished => {
        'worklet';
        if (finished) {
          scheduleOnRN(handleDismissEntry);
        }
      }),
    );
    opacity.set(withTiming(0, { duration: TIMING.FAST }));
  };

  const isTop = stackIndex === 0;
  const depthScale = isTop ? 1 : ALERT.DEPTH_SCALE;
  const depthTranslateY = isTop ? 0 : ALERT.DEPTH_TRANSLATE_Y;
  const depthOpacity = isTop ? 1 : ALERT.DEPTH_OPACITY;

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.get() * depthOpacity,
    transform: [
      { scale: scale.get() * depthScale },
      { translateY: depthTranslateY },
    ],
  }));

  const isVerticalLayout = entry.buttons.length > 2;

  return (
    <Animated.View
      // This is an in-app modal, so Detox's system-alert matchers can't reach it.
      // Only the TOP card claims the stable id: `AlertStack` renders up to
      // ALERT.MAX_VISIBLE at once, and two matches fail a bare `by.id` with a
      // multiple-match error. The card behind is inert anyway.
      testID={isTop ? 'alert-modal' : 'alert-modal-behind'}
      style={[styles.card, animatedStyle, { zIndex: 100 - stackIndex }]}
      accessibilityViewIsModal={isTop}
    >
      <Text
        size="lg"
        weight="semibold"
        align="center"
        style={styles.title}
        accessibilityRole="header"
      >
        {entry.title}
      </Text>
      {entry.message ? (
        <Text
          size="base"
          tone="secondary"
          align="center"
          style={styles.message}
        >
          {entry.message}
        </Text>
      ) : null}
      <View
        style={[
          styles.buttonContainer,
          isVerticalLayout && styles.buttonContainerVertical,
        ]}
      >
        {entry.buttons.map((button, index) => {
          const isCancel = button.style === 'cancel';
          const isDestructive = button.style === 'destructive';

          return (
            <AppPressable
              key={index}
              // Index-keyed: the label is translated and `style` is optional, so
              // neither is a stable handle. Omitted on the stacked card, whose
              // unpressable buttons would still resolve for a Detox matcher.
              testID={isTop ? `alert-button-${index}` : undefined}
              accessibilityRole="button"
              style={[
                styles.button,
                !isVerticalLayout && styles.buttonFlex,
                isCancel && styles.cancelButton,
                !isCancel && !isDestructive && styles.defaultButton,
                isDestructive && styles.destructiveButton,
              ]}
              onPress={() => handleButtonPress(button)}
            >
              <Text
                size="base"
                align="center"
                style={[
                  styles.buttonText,
                  isCancel && styles.cancelButtonText,
                  isDestructive && styles.destructiveButtonText,
                  !isCancel && !isDestructive && styles.defaultButtonText,
                ]}
              >
                {button.text}
              </Text>
            </AppPressable>
          );
        })}
      </View>
    </Animated.View>
  );
};

/** Dismiss the top alert by invoking its cancel button (or single button) callback. */
function dismissTopAlert(
  alerts: AlertEntry[],
  onDismiss: (id: number) => void,
) {
  if (alerts.length === 0) return;
  const topAlert = alerts[alerts.length - 1];
  const cancelButton = topAlert.buttons.find(b => b.style === 'cancel');
  if (cancelButton) {
    cancelButton.onPress?.();
  } else if (topAlert.buttons.length === 1) {
    topAlert.buttons[0].onPress?.();
  }
  onDismiss(topAlert.id);
}

interface AlertStackProps {
  alerts: AlertEntry[];
  onDismiss: (id: number) => void;
}

const AlertStack: React.FC<AlertStackProps> = ({ alerts, onDismiss }) => {
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    backdropOpacity.set(
      withTiming(alerts.length > 0 ? ALERT.BACKDROP_OPACITY : 0, {
        duration: TIMING.STANDARD,
      }),
    );
  }, [alerts.length, backdropOpacity]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.get(),
  }));

  const visibleAlerts = alerts.slice(-ALERT.MAX_VISIBLE).reverse();

  const handleBackdropPress = () => {
    dismissTopAlert(alerts, onDismiss);
  };

  return (
    <View style={styles.stackContainer}>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable
          style={styles.backdropPressable}
          onPress={handleBackdropPress}
        />
      </Animated.View>

      {visibleAlerts.map((entry, index) => (
        <AlertCard
          key={entry.id}
          entry={entry}
          stackIndex={index}
          onDismiss={onDismiss}
        />
      ))}
    </View>
  );
};

/**
 * An alert nobody has to answer: every button only dismisses it, so a second copy
 * says nothing new. Anything with an `onPress` is a decision and is never
 * collapsed — dropping one drops the callback a caller is waiting on.
 */
const isInformational = (entry: AlertEntry): boolean =>
  entry.buttons.every(button => button.onPress == null);

/** Matches on rendered content (title + message) — what the user sees repeated. */
const isRedundant = (alerts: AlertEntry[], entry: AlertEntry): boolean =>
  isInformational(entry) &&
  alerts.some(
    existing =>
      isInformational(existing) &&
      existing.title === entry.title &&
      existing.message === entry.message,
  );

interface AlertProviderProps {
  children: React.ReactNode;
}

export const AlertProvider: React.FC<AlertProviderProps> = ({ children }) => {
  const [alerts, setAlerts] = useState<AlertEntry[]>([]);

  useEffect(() => {
    alertService.init((entry: AlertEntry) => {
      // Without this a run of identical failures (every tap while the API is down)
      // stacks one modal per failure, each needing its own dismissal.
      setAlerts(prev => (isRedundant(prev, entry) ? prev : [...prev, entry]));
    });
  }, []);

  const handleDismiss = (id: number) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const handleRequestClose = () => {
    dismissTopAlert(alerts, handleDismiss);
  };

  return (
    <>
      {children}
      {alerts.length > 0 ? (
        <Modal
          transparent
          visible
          statusBarTranslucent
          navigationBarTranslucent
          presentationStyle="overFullScreen"
          onRequestClose={handleRequestClose}
        >
          <AlertStack alerts={alerts} onDismiss={handleDismiss} />
        </Modal>
      ) : null}
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  stackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'black',
  },
  backdropPressable: {
    flex: 1,
  },
  card: {
    position: 'absolute',
    margin: theme.spacing['5'],
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    borderCurve: 'continuous',
    padding: theme.spacing['5'],
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 4,
        blurRadius: 16,
        spreadDistance: 0,
        color: 'rgba(0, 0, 0, 0.2)',
      },
    ],
    minWidth: 300,
    maxWidth: '85%',
  },
  title: {
    marginBottom: theme.spacing.sm,
  },
  message: {
    marginBottom: theme.spacing.md,
    lineHeight: theme.typography.fontSize.base * 1.5,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing['3'],
    gap: theme.spacing.sm,
  },
  buttonContainerVertical: {
    flexDirection: 'column',
  },
  button: {
    padding: theme.spacing['3'],
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: theme.sizes.button.md,
  },
  buttonFlex: {
    flex: 1,
  },
  defaultButton: {
    backgroundColor: theme.colors.primary,
  },
  cancelButton: {
    backgroundColor: theme.colors.background,
  },
  destructiveButton: {
    backgroundColor: theme.colors.error,
  },
  buttonText: {
    fontWeight: theme.fonts.weight.semibold,
  },
  defaultButtonText: {
    color: theme.colors.onPrimary,
  },
  cancelButtonText: {
    color: theme.colors.textSecondary,
    fontWeight: theme.fonts.weight.medium,
  },
  destructiveButtonText: {
    color: theme.colors.onError,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
