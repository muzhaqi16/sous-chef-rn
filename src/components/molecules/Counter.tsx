import React, { useLayoutEffect } from 'react';
import { Icon } from '#utils/iconUtils';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { HapticService } from '#services/haptic/HapticService';
import { SPRING } from '#/constants/animations';
import { Pressable } from '#components/atoms/themedComponents';
import { Text } from '#components/atoms/Text';

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
  styles.useVariants({ disabled });

  const countScale = useSharedValue(1);

  // Bounce animation when count changes
  useLayoutEffect(() => {
    countScale.set(
      withSequence(
        withSpring(1.15, SPRING.SNAPPY),
        withSpring(1, SPRING.SNAPPY),
      ),
    );
  }, [count, countScale]);

  const countAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: countScale.get() }],
  }));

  const handleDecrement = () => {
    if (!disabled) {
      HapticService.selection();
      onDecrement();
    }
  };

  const handleIncrement = () => {
    if (!disabled) {
      HapticService.selection();
      onIncrement();
    }
  };

  const iconTone = disabled ? 'textTertiary' : 'textPrimary';

  return (
    <View
      style={styles.container}
      accessible={true}
      accessibilityRole="adjustable"
      accessibilityLabel={`${label}, ${count}`}
      accessibilityValue={{
        min: 0,
        now: count,
        text: String(count),
      }}
      accessibilityActions={[
        { name: 'increment', label: `Increase ${label}` },
        { name: 'decrement', label: `Decrease ${label}` },
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
      }}
    >
      <Pressable
        onPress={handleDecrement}
        disabled={disabled}
        style={({ pressed }) => [
          styles.counterButton,
          pressed && !disabled && styles.pressed,
        ]}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${label}`}
        accessibilityHint={`Current ${label} is ${count}`}
        accessibilityState={{ disabled }}
      >
        <Icon tone={iconTone} name="remove-outline" size={11} />
      </Pressable>
      <Animated.View style={countAnimatedStyle}>
        <Text
          size="xl"
          weight="medium"
          lineHeight="tight"
          tone={disabled ? 'tertiary' : 'primary'}
          maxFontSizeMultiplier={1.5}
          style={styles.counterActionText}
          accessibilityLabel={`${label} count: ${count}`}
        >
          {count}
        </Text>
      </Animated.View>
      <Pressable
        onPress={handleIncrement}
        disabled={disabled}
        style={({ pressed }) => [
          styles.counterButton,
          pressed && !disabled && styles.pressed,
        ]}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`Increase ${label}`}
        accessibilityHint={`Current ${label} is ${count}`}
        accessibilityState={{ disabled }}
      >
        <Icon tone={iconTone} name="add" size={11} />
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
    variants: {
      disabled: {
        true: { borderColor: theme.colors.border },
      },
    },
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
    paddingHorizontal: theme.spacing['2.5'],
  },
  pressed: {
    opacity: theme.opacity.pressed,
    transform: [{ scale: 0.92 }],
  },
}));
