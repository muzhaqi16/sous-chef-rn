import React, { memo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import type { BackdropProps } from './types';

export const Backdrop = memo<BackdropProps>(({
  isActive,
  onTap,
  opacity = 0.2
}) => {
  const backdropStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(isActive.value ? opacity : 0, { duration: 250 }),
    };
  }, [opacity]);

  const backdropProps = useAnimatedProps(() => {
    return {
      pointerEvents: isActive.value ? 'auto' : 'none',
    } as any;
  }, []);

  return (
    <Animated.View
      onTouchStart={onTap}
      animatedProps={backdropProps}
      style={[styles.backdrop, backdropStyle]}
    />
  );
});

Backdrop.displayName = 'Backdrop';

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 1)', // Will be controlled by animated opacity
  },
});