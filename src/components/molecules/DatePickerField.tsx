import React, { useState } from 'react';
import { View, Text, Platform } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { Label } from '#components/atoms/Label';

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
  const { theme } = useUnistyles();
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
      <Pressable
        style={({ pressed }) => [
          styles.input,
          error && styles.inputError,
          pressed && styles.pressed,
        ]}
        onPress={handlePress}
      >
        <Icon
          name="calendar-outline"
          size={20}
          color={theme.colors.textSecondary}
        />
        <Text style={[styles.dateText, !value && styles.placeholder]}>
          {value ? formatDate(value) : placeholder}
        </Text>
      </Pressable>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {!!showPicker && (
        <DateTimePicker
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
    fontSize: theme.fonts.size.md,
    color: theme.colors.inputText,
  },
  placeholder: {
    color: theme.colors.textSecondary,
  },
  errorText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.error,
    marginTop: theme.spacing.xs,
  },
  calendarPicker: {
    alignSelf: 'center',
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
