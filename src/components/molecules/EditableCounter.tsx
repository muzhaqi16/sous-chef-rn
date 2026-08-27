import React, { useState } from 'react';
import { useTranslation } from '#/i18n';
import { View, type GestureResponderEvent } from 'react-native';
import {
  Pressable,
  ThemedBottomSheetTextInput,
  ThemedTextInput,
} from '#components/atoms/themedComponents';
import { Icon } from '#utils/iconUtils';
import { StyleSheet } from 'react-native-unistyles';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { Label } from '#components/atoms/Label';
import { Text } from '#components/atoms/Text';
import { useIsBottomSheetInput } from '#context/BottomSheetInputContext';

interface EditableCounterProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  /** Validation message, rendered under the counter with a red border, as `FormInput` does. */
  error?: string;
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
  error,
  placeholder = '1',
  min = 0,
  step = 1,
  disabled = false,
  required = false,
  testID,
}) => {
  const { t } = useTranslation();
  const [isFocused, setIsFocused] = useState(false);
  // Inside a sheet the value field has to be a `BottomSheetTextInput`, or
  // gorhom never registers the focus and the host sheet ignores the keyboard.
  // Chosen from context because this counter is also used on full screens,
  // where `BottomSheetTextInput` would throw. Same rule as `FormInput`.
  const InputComponent = useIsBottomSheetInput()
    ? ThemedBottomSheetTextInput
    : ThemedTextInput;

  // `error` last so an invalid value stays visibly invalid while focused —
  // the focus ring would otherwise paint over the thing being reported.
  styles.useVariants({ focused: isFocused, disabled, error: !!error });

  const handleIncrement = (e?: GestureResponderEvent) => {
    e?.stopPropagation?.();
    if (disabled) return;
    const currentValue = parseFractionalInput(value) ?? 0;
    const newValue = currentValue + step;
    onChangeText(String(newValue));
  };

  const handleDecrement = (e?: GestureResponderEvent) => {
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
        style={styles.container}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t('a11y.counterValue', {
          label: label || t('labels.quantity'),
          value,
        })}
        accessibilityValue={{
          min: min,
          now: parseFractionalInput(value) ?? 0,
          text: value,
        }}
        accessibilityActions={[
          { name: 'increment', label: t('editableCounter.increase') },
          { name: 'decrement', label: t('editableCounter.decrease') },
        ]}
        onAccessibilityAction={event => {
          switch (event.nativeEvent.actionName) {
            case 'increment':
              handleIncrement();
              break;
            case 'decrement':
              handleDecrement();
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
          accessibilityLabel={t('editableCounter.decrease')}
          accessibilityHint={`Current quantity is ${value}`}
          accessibilityState={{ disabled }}
        >
          <Icon
            name="remove-outline"
            size={16}
            tone={disabled ? 'iconDisabled' : 'white'}
          />
        </Pressable>

        {/* Editable Number Input */}
        <InputComponent
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          keyboardType="numbers-and-punctuation"
          editable={!disabled}
          selectTextOnFocus
          textAlign="center"
          accessible
          accessibilityLabel={
            label ? t('a11y.valueSuffix', { label }) : t('a11y.quantityValue')
          }
          accessibilityHint={t('editableCounter.hint')}
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
          accessibilityLabel={t('editableCounter.increase')}
          accessibilityHint={`Current quantity is ${value}`}
          accessibilityState={{ disabled }}
        >
          <Icon
            name="add"
            size={16}
            tone={disabled ? 'iconDisabled' : 'white'}
          />
        </Pressable>
      </View>
      {error ? (
        <Text size="sm" tone="error" style={styles.errorText}>
          {error}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  errorText: {
    marginTop: theme.spacing.xs,
  },
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
    borderCurve: 'continuous',
    paddingHorizontal: theme.spacing.xs,
    variants: {
      focused: {
        true: {
          borderColor: theme.colors.primary,
          borderWidth: 2,
        },
      },
      disabled: {
        true: {
          borderColor: theme.colors.border,
        },
      },
      error: {
        true: {
          borderColor: theme.colors.error,
          borderWidth: 2,
        },
      },
    },
  },
  button: {
    zIndex: 9,
    backgroundColor: theme.colors.primary,
    width: 35,
    height: 35,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
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
    variants: {
      disabled: {
        true: { color: theme.colors.iconDisabled },
      },
    },
  },
}));
