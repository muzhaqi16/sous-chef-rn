import React from 'react';
import { View, ViewStyle } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { Text } from '#components/atoms/Text';

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
  return (
    <View style={[styles.container, containerStyle]}>
      <AppPressable
        style={styles.checkboxRow}
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
          {!!checked && <Icon name="checkmark" size={18} tone="white" />}
        </View>
        <Text
          size="base"
          style={[styles.label, disabled && styles.disabledLabel]}
        >
          {label}
        </Text>
      </AppPressable>
      {error ? (
        <Text size="sm" tone="error" style={styles.errorText}>
          {error}
        </Text>
      ) : null}
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
    borderCurve: 'continuous',
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
    flex: 1,
  },
  disabledLabel: {
    opacity: theme.opacity.disabled,
  },
  errorText: {
    marginTop: theme.spacing.xs,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
