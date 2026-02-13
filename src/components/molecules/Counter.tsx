import React, { useCallback, useEffect } from 'react';
import Icon from '@react-native-vector-icons/ionicons';
import {Text, View, Pressable} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {HapticService} from '#services/haptic/HapticService';

export const Counter = ({
  count,
  onIncrement,
  onDecrement,
  disabled = false,
  label = 'quantity',
}: {
  count: number;
  onIncrement: () => void;
  onDecrement: () => void;
  disabled?: boolean;
  label?: string;
}) => {
  const {theme} = useUnistyles();
  const countScale = useSharedValue(1);

  // Bounce animation when count changes
  useEffect(() => {
    countScale.value = withSequence(
      withSpring(1.15, {damping: 10, stiffness: 400}),
      withSpring(1, {damping: 10, stiffness: 400}),
    );
  }, [count, countScale]);

  const countAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: countScale.value}],
  }));

  const handleDecrement = useCallback(
    (e: any) => {
      e.stopPropagation();
      if (!disabled) {
        HapticService.selection();
        onDecrement();
      }
    },
    [disabled, onDecrement],
  );

  const handleIncrement = useCallback(
    (e: any) => {
      e.stopPropagation();
      if (!disabled) {
        HapticService.selection();
        onIncrement();
      }
    },
    [disabled, onIncrement],
  );

  const iconColor = disabled ? theme.colors.textTertiary : theme.colors.textPrimary;

  return (
    <View
      style={[styles.container, disabled && styles.containerDisabled]}
      accessible={true}
      accessibilityRole="adjustable"
      accessibilityLabel={`${label}, ${count}`}
      accessibilityValue={{
        min: 0,
        now: count,
        text: String(count),
      }}
      accessibilityActions={[
        {name: 'increment', label: `Increase ${label}`},
        {name: 'decrement', label: `Decrease ${label}`},
      ]}
      onAccessibilityAction={event => {
        switch (event.nativeEvent.actionName) {
          case 'increment':
            if (!disabled) onIncrement();
            break;
          case 'decrement':
            if (!disabled) onDecrement();
            break;
        }
      }}>
      <Pressable
        onPress={handleDecrement}
        disabled={disabled}
        style={({pressed}) => [
          styles.counterButton,
          pressed && !disabled && styles.pressed,
        ]}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${label}`}
        accessibilityHint={`Current ${label} is ${count}`}
        accessibilityState={{disabled}}>
        <Icon color={iconColor} name="remove" size={11} />
      </Pressable>
      <Animated.View style={countAnimatedStyle}>
        <Text
          style={[styles.counterActionText, disabled && styles.textDisabled]}
          accessibilityLabel={`${label} count: ${count}`}>
          {count}
        </Text>
      </Animated.View>
      <Pressable
        onPress={handleIncrement}
        disabled={disabled}
        style={({pressed}) => [
          styles.counterButton,
          pressed && !disabled && styles.pressed,
        ]}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`Increase ${label}`}
        accessibilityHint={`Current ${label} is ${count}`}
        accessibilityState={{disabled}}>
        <Icon color={iconColor} name="add" size={11} />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginRight: theme.spacing['2.5'],
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.borderLight,
    borderStyle: 'solid',
    borderRadius: theme.radii.full,
  },
  counterButton: {
    zIndex: theme.zIndex.base,
    backgroundColor: theme.colors.surface,
    width: theme.sizes.button.sm,
    height: theme.sizes.button.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.full,
    ...theme.shadows.sm,
  },
  counterActionText: {
    fontSize: theme.typography.fontSize.xl,
    paddingHorizontal: theme.spacing['2.5'],
    lineHeight: 20,
    fontWeight: '500',
    color: theme.colors.textPrimary,
  },
  pressed: {
    opacity: 0.7,
    transform: [{scale: 0.92}],
  },
  containerDisabled: {
    borderColor: theme.colors.border,
  },
  textDisabled: {
    color: theme.colors.textTertiary,
  },
}));
