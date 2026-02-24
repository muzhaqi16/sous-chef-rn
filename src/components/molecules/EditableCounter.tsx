import React, { useState } from 'react';
import { View, TextInput, Pressable } from 'react-native';
import Icon from '@react-native-vector-icons/ionicons';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { Label } from '#components/atoms/Label';

interface EditableCounterProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  min?: number;
  step?: number;
  disabled?: boolean;
  required?: boolean;
  testID?: string;
}

/**
 * EditableCounter - A pill-shaped counter with +/- buttons and editable text input
 *
 * Combines the modern pill design from Counter with editable text input.
 * Supports fractional values (1/2, 1.5, etc.)
 *
 * @example
 * <EditableCounter
 *   label="Quantity"
 *   value={quantity}
 *   onChangeText={setQuantity}
 *   required
 * />
 */
export const EditableCounter: React.FC<EditableCounterProps> = ({
  label,
  value,
  onChangeText,
  placeholder = '1',
  min = 0,
  step = 1,
  disabled = false,
  required = false,
  testID,
}) => {
  const { theme } = useUnistyles();
  const [isFocused, setIsFocused] = useState(false);

  const handleIncrement = (e: any) => {
    e?.stopPropagation?.();
    if (disabled) return;
    const currentValue = parseFractionalInput(value) ?? 0;
    const newValue = currentValue + step;
    onChangeText(String(newValue));
  };

  const handleDecrement = (e: any) => {
    e?.stopPropagation?.();
    if (disabled) return;
    const currentValue = parseFractionalInput(value) ?? 0;
    const newValue = Math.max(min, currentValue - step);
    onChangeText(String(newValue));
  };

  return (
    <View style={styles.wrapper}>
      {label ? <Label required={required}>{label}</Label> : null}
      <View
        style={[
          styles.container,
          isFocused && styles.containerFocused,
          disabled && styles.containerDisabled,
        ]}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`${label || 'Quantity'}, ${value}`}
        accessibilityValue={{
          min: min,
          now: parseFractionalInput(value) ?? 0,
          text: value,
        }}
        accessibilityActions={[
          { name: 'increment', label: 'Increase quantity' },
          { name: 'decrement', label: 'Decrease quantity' },
        ]}
        onAccessibilityAction={event => {
          switch (event.nativeEvent.actionName) {
            case 'increment':
              handleIncrement(null);
              break;
            case 'decrement':
              handleDecrement(null);
              break;
          }
        }}
      >
        {/* Decrement Button */}
        <Pressable
          onPress={handleDecrement}
          disabled={disabled}
          style={({ pressed }) => [
            styles.button,
            pressed && !disabled && styles.pressed,
          ]}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Decrease quantity"
          accessibilityHint={`Current quantity is ${value}`}
          accessibilityState={{ disabled }}
        >
          <Icon
            name="remove-outline"
            size={theme.fonts.size.md}
            color={disabled ? theme.colors.iconDisabled : theme.colors.white}
          />
        </Pressable>

        {/* Editable Number Input */}
        <TextInput
          style={[styles.input, disabled && styles.inputDisabled]}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textSecondary}
          keyboardType="numbers-and-punctuation"
          editable={!disabled}
          selectTextOnFocus
          textAlign="center"
          accessible
          accessibilityLabel={label ? `${label} value` : 'Quantity value'}
          accessibilityHint="Tap to edit manually or use buttons to adjust"
          testID={testID}
        />

        {/* Increment Button */}
        <Pressable
          onPress={handleIncrement}
          disabled={disabled}
          style={({ pressed }) => [
            styles.button,
            pressed && !disabled && styles.pressed,
          ]}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Increase quantity"
          accessibilityHint={`Current quantity is ${value}`}
          accessibilityState={{ disabled }}
        >
          <Icon
            name="add"
            size={theme.fonts.size.md}
            color={disabled ? theme.colors.iconDisabled : theme.colors.white}
          />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  wrapper: {
    // No marginBottom - let parent (FieldRow) handle spacing
  },
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 48,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderStyle: 'solid',
    borderRadius: theme.radii.md,
    paddingHorizontal: 4,
  },
  containerFocused: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
  },
  containerDisabled: {
    borderColor: theme.colors.border,
  },
  button: {
    zIndex: 9,
    backgroundColor: theme.colors.primary,
    width: 35,
    height: 35,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  input: {
    flex: 1,
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
  inputDisabled: {
    color: theme.colors.iconDisabled,
  },
}));
