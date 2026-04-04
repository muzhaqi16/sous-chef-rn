import React, { useState, useEffect } from 'react';
import { View, Text, Animated } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { TIMING } from '#constants/animations';
import { Pressable } from 'react-native-gesture-handler';

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
  const [slide] = useState(() => new Animated.Value(-100));

  useEffect(() => {
    // slide down
    Animated.timing(slide, {
      toValue: 0,
      duration: TIMING.SLOW,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(slide, {
        toValue: -100,
        duration: TIMING.SLOW,
        useNativeDriver: true,
      }).start(() => {
        setShow(false);
        onClose?.();
      });
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose, slide]);

  if (!show) return null;

  return (
    <Animated.View
      style={[styles.bannerContainer, { transform: [{ translateY: slide }] }]}
    >
      <View style={styles.bannerInner}>
        {title ? <Text style={styles.bannerTitle}>{title}</Text> : null}
        <Text style={styles.bannerMessage}>{message}</Text>
        <Pressable
          onPress={() => {
            Animated.timing(slide, {
              toValue: -100,
              duration: TIMING.STANDARD,
              useNativeDriver: true,
            }).start(() => {
              setShow(false);
              onClose?.();
            });
          }}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Text style={styles.bannerClose}>×</Text>
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
    fontWeight: 'bold',
    marginRight: theme.spacing.sm,
    flexShrink: 1,
  },
  bannerMessage: {
    color: theme.colors.white,
    flex: 1,
  },
  bannerClose: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.lg,
    paddingHorizontal: theme.spacing.sm,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
