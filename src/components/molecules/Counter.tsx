import React from 'react';
import Icon from '@react-native-vector-icons/ionicons';
import { Text, View, Pressable } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

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
  const { theme } = useUnistyles();

  const handleDecrement = (e: any) => {
    e.stopPropagation();
    if (!disabled) {
      onDecrement();
    }
  };

  const handleIncrement = (e: any) => {
    e.stopPropagation();
    if (!disabled) {
      onIncrement();
    }
  };

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
        { name: 'increment', label: `Increase ${label}` },
        { name: 'decrement', label: `Decrease ${label}` },
      ]}
      onAccessibilityAction={(event) => {
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
          styles.button,
          pressed && !disabled && styles.pressed,
        ]}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${label}`}
        accessibilityHint={`Current ${label} is ${count}`}
        accessibilityState={{ disabled }}
      >
        <Icon color={iconColor} name="remove" size={11} />
      </Pressable>
      <Text
        style={[styles.counterActionText, disabled && styles.textDisabled]}
        accessibilityLabel={`${label} count: ${count}`}
      >
        {count}
      </Text>
      <Pressable
        onPress={handleIncrement}
        disabled={disabled}
        style={({ pressed }) => [
          styles.button,
          pressed && !disabled && styles.pressed,
        ]}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`Increase ${label}`}
        accessibilityHint={`Current ${label} is ${count}`}
        accessibilityState={{ disabled }}
      >
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
    borderColor: theme.colors.border,
    borderStyle: 'solid',
    borderRadius: theme.radii.full,
  },
  button: {
    zIndex: 9,
    backgroundColor: theme.colors.surface,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.full,
    ...theme.shadows.sm,
  },
  counterActionText: {
    fontSize: theme.typography.fontSize.lg,
    paddingHorizontal: theme.spacing['2.5'],
    lineHeight: 20,
    fontWeight: '500',
    color: theme.colors.textPrimary,
  },
  pressed: {
    opacity: 0.7,
  },
  containerDisabled: {
    borderColor: theme.colors.borderLight,
  },
  textDisabled: {
    color: theme.colors.textTertiary,
  },
}));
