import React, { useState } from 'react';
import { View, Platform } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { ThemedDateTimePicker } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { Label } from '#components/atoms/Label';
import { Text } from '#components/atoms/Text';

interface DatePickerFieldProps {
  label?: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  required?: boolean;
  error?: string;
  testID?: string;
}

/**
 * DatePickerField - Reusable date picker with label and icon
 * Handles platform-specific date picker display (iOS inline, Android dialog)
 */
export const DatePickerField: React.FC<DatePickerFieldProps> = ({
  label,
  value,
  onChange,
  placeholder = 'Select date',
  minimumDate,
  maximumDate,
  required,
  error,
  testID,
}) => {
  const [showPicker, setShowPicker] = useState(false);

  const handleDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    // On Android, the picker closes automatically
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }

    if (event.type === 'set' && selectedDate) {
      onChange(selectedDate);
      setShowPicker(false);
    } else if (event.type === 'dismissed') {
      // User cancelled
      setShowPicker(false);
    }
  };

  const handlePress = () => {
    setShowPicker(prev => !prev);
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <View style={styles.container} testID={testID}>
      {label ? <Label required={required}>{label}</Label> : null}
      <AppPressable
        style={[styles.input, error && styles.inputError]}
        onPress={handlePress}
      >
        <Icon name="calendar-outline" size={20} tone="textSecondary" />
        <Text size="md" style={[styles.dateText, !value && styles.placeholder]}>
          {value ? formatDate(value) : placeholder}
        </Text>
      </AppPressable>
      {error ? (
        <Text size="sm" tone="error" style={styles.errorText}>
          {error}
        </Text>
      ) : null}
      {!!showPicker && (
        <ThemedDateTimePicker
          style={styles.calendarPicker}
          value={value || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={handleDateChange}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
  },
  required: {
    color: theme.colors.error,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  dateText: {
    flex: 1,
    color: theme.colors.inputText,
  },
  placeholder: {
    color: theme.colors.textSecondary,
  },
  errorText: {
    marginTop: theme.spacing.xs,
  },
  calendarPicker: {
    alignSelf: 'center',
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
