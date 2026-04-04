import React from 'react';
import { View, Text, ViewStyle } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';

interface FormCheckboxProps {
  label: string;
  checked: boolean;
  onPress: () => void;
  error?: string;
  disabled?: boolean;
  containerStyle?: ViewStyle;
}

export const FormCheckbox: React.FC<FormCheckboxProps> = ({
  label,
  checked,
  onPress,
  error,
  disabled = false,
  containerStyle,
}) => {
  const { theme } = useUnistyles();

  return (
    <View style={[styles.container, containerStyle]}>
      <Pressable
        style={({ pressed }) => [styles.checkboxRow, pressed && styles.pressed]}
        onPress={onPress}
        disabled={disabled}
      >
        <View
          style={[
            styles.checkbox,
            checked && styles.checkboxChecked,
            disabled && styles.disabledCheckbox,
          ]}
        >
          {!!checked && (
            <Icon name="checkmark" size={18} color={theme.colors.white} />
          )}
        </View>
        <Text style={[styles.label, disabled && styles.disabledLabel]}>
          {label}
        </Text>
      </Pressable>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    marginBottom: theme.spacing.md,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: theme.radii.xs,
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing['3'],
  },
  checkboxChecked: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  disabledCheckbox: {
    opacity: theme.opacity.disabled,
  },
  label: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textPrimary,
    flex: 1,
  },
  disabledLabel: {
    opacity: theme.opacity.disabled,
  },
  errorText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.error,
    marginTop: theme.spacing.xs,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
