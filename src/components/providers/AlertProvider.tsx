import React, { useState, useEffect, useRef } from 'react';
import { Modal, View, Pressable } from 'react-native';
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

// ─── AlertCard ────────────────────────────────────────────────────────────────

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

  // Closure avoids passing onDismiss (a function) through the worklet boundary where it would serialize to an object
  const handleDismissEntry = () => {
    onDismiss(entry.id);
  };

  // Enter animation
  useEffect(() => {
    scale.set(withSpring(1, SPRING.GENTLE));
    opacity.set(withTiming(1, { duration: TIMING.STANDARD }));
  }, [scale, opacity]);

  const handleButtonPress = (button: AlertButton) => {
    if (dismissing.current) return;
    dismissing.current = true;

    // Fire the callback immediately
    button.onPress?.();

    // Animate out then remove
    scale.set(
      withTiming(ALERT.EXIT_SCALE_TO, { duration: TIMING.FAST }, finished => {
        if (finished) {
          scheduleOnRN(handleDismissEntry);
        }
      }),
    );
    opacity.set(withTiming(0, { duration: TIMING.FAST }));
  };

  // Depth effect for cards behind the top one
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
            <Pressable
              key={index}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.button,
                !isVerticalLayout && styles.buttonFlex,
                isCancel && styles.cancelButton,
                !isCancel && !isDestructive && styles.defaultButton,
                isDestructive && styles.destructiveButton,
                pressed && styles.pressed,
              ]}
              onPress={() => handleButtonPress(button)}
            >
              <Text
                size="base"
                style={[
                  styles.buttonText,
                  isCancel && styles.cancelButtonText,
                  isDestructive && styles.destructiveButtonText,
                  !isCancel && !isDestructive && styles.defaultButtonText,
                ]}
              >
                {button.text}
              </Text>
            </Pressable>
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

// ─── AlertStack ───────────────────────────────────────────────────────────────

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

  // Show only the top MAX_VISIBLE alerts
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

// ─── AlertProvider ─────────────────────────────────────────────────────────────

interface AlertProviderProps {
  children: React.ReactNode;
}

export const AlertProvider: React.FC<AlertProviderProps> = ({ children }) => {
  const [alerts, setAlerts] = useState<AlertEntry[]>([]);

  useEffect(() => {
    alertService.init((entry: AlertEntry) => {
      setAlerts(prev => [...prev, entry]);
    });
  }, []);

  const handleDismiss = (id: number) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  // Handle Android hardware back button — dismiss top alert
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

// ─── Styles ───────────────────────────────────────────────────────────────────

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
    color: theme.colors.white,
  },
  cancelButtonText: {
    color: theme.colors.textSecondary,
    fontWeight: theme.fonts.weight.medium,
  },
  destructiveButtonText: {
    color: theme.colors.white,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
