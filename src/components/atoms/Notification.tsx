import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { TIMING } from '#constants/animations';
import { Pressable } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Text } from '#components/atoms/Text';

interface NotificationBannerProps {
  title?: string;
  message: string;
  duration?: number; // in ms
  onClose?: () => void;
}

export const NotificationBanner: React.FC<NotificationBannerProps> = ({
  title,
  message,
  duration = 5000,
  onClose,
}) => {
  const [show, setShow] = useState(true);
  const slide = useSharedValue(-100);

  // Auto-dismiss: entire animation sequence on UI thread (no setTimeout needed).
  // The dismiss callback is defined inside the effect so it captures the latest
  // onClose without needing a ref, and satisfies exhaustive-deps naturally.
  useEffect(() => {
    const handleAutoDismiss = () => {
      setShow(false);
      onClose?.();
    };

    slide.set(
      withSequence(
        withTiming(0, { duration: TIMING.SLOW }),
        withDelay(
          duration,
          withTiming(-100, { duration: TIMING.SLOW }, finished => {
            'worklet';
            if (finished) {
              scheduleOnRN(handleAutoDismiss);
            }
          }),
        ),
      ),
    );
    return () => cancelAnimation(slide);
  }, [duration, slide, onClose]);

  // Manual dismiss (close button) — pre-defined RN-scope callback for scheduleOnRN
  const handleManualDismiss = () => {
    setShow(false);
    onClose?.();
  };

  const slideOut = () => {
    cancelAnimation(slide);
    slide.set(
      withTiming(-100, { duration: TIMING.SLOW }, finished => {
        'worklet';
        if (finished) {
          scheduleOnRN(handleManualDismiss);
        }
      }),
    );
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slide.get() }],
  }));

  if (!show) return null;

  return (
    <Animated.View style={[styles.bannerContainer, animatedStyle]}>
      <View style={styles.bannerInner}>
        {title ? (
          <Text weight="bold" style={styles.bannerTitle}>
            {title}
          </Text>
        ) : null}
        <Text style={styles.bannerMessage}>{message}</Text>
        <Pressable
          onPress={slideOut}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Text size="lg" style={styles.bannerClose}>
            ×
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create(theme => ({
  bannerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: theme.zIndex.overlay,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing['2xl'], // for status bar
  },
  bannerInner: {
    backgroundColor: theme.colors.textPrimary,
    padding: theme.spacing['3'],
    borderRadius: theme.radii.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerTitle: {
    color: theme.colors.white,
    marginRight: theme.spacing.sm,
    flexShrink: 1,
  },
  bannerMessage: {
    color: theme.colors.white,
    flex: 1,
  },
  bannerClose: {
    color: theme.colors.white,
    paddingHorizontal: theme.spacing.sm,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
