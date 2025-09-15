import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {useUnistyles} from 'react-native-unistyles';
import {Icon} from '#utils';

interface FormCheckboxProps {
  label: string;
  checked: boolean;
  onPress: () => void;
  error?: string;
  disabled?: boolean;
  containerStyle?: any;
}

export const FormCheckbox: React.FC<FormCheckboxProps> = ({
  label,
  checked,
  onPress,
  error,
  disabled = false,
  containerStyle,
}) => {
  const {theme} = useUnistyles();

  const styles = StyleSheet.create({
    container: {
      marginBottom: 16,
      ...containerStyle,
    },
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: checked ? theme.colors.primary : theme.colors.border,
      backgroundColor: checked ? theme.colors.primary : 'transparent',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    disabledCheckbox: {
      opacity: 0.5,
    },
    label: {
      fontSize: 16,
      color: theme.colors.textPrimary,
      flex: 1,
    },
    disabledLabel: {
      opacity: 0.5,
    },
    errorText: {
      fontSize: 14,
      color: '#dc3545',
      marginTop: 4,
    },
  });

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.checkboxRow}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.7}>
        <View style={[styles.checkbox, disabled && styles.disabledCheckbox]}>
          {checked && <Icon name="check" size={18} color="white" />}
        </View>
        <Text style={[styles.label, disabled && styles.disabledLabel]}>
          {label}
        </Text>
      </TouchableOpacity>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};
