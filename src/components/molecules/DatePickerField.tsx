import React, { useState } from 'react';
import { View } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { MonthCalendar } from '#components/atoms/MonthCalendar';
import { Reveal } from '#components/atoms/Reveal';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { Label } from '#components/atoms/Label';
import { Text } from '#components/atoms/Text';
import { formatMonthDayYear } from '#/utils/formatters/date';
import { useTranslation } from '#/i18n';
import { kitTestIDs } from '#components/testIDs';

interface DatePickerFieldProps {
  label?: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  required?: boolean;
  /** A set date can be cleared back to none. */
  clearable?: boolean;
  error?: string;
  /** The field's; the calendar's is `kitTestIDs.datePickerCalendar(testID)`. */
  testID?: string;
}

/**
 * A date as a field that slides the app's month calendar open under it, the
 * same on both platforms. Picking a day closes it.
 */
export const DatePickerField: React.FC<DatePickerFieldProps> = ({
  label,
  value,
  onChange,
  placeholder,
  minimumDate,
  maximumDate,
  required,
  clearable,
  error,
  testID,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.container} testID={testID}>
      {label ? <Label required={required}>{label}</Label> : null}
      <View style={styles.row}>
        <AppPressable
          style={[styles.input, error && styles.inputError]}
          onPress={() => setOpen(prev => !prev)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
        >
          <Icon name="calendar-outline" size={20} tone="textSecondary" />
          <Text style={[styles.dateText, !value && styles.placeholder]}>
            {value
              ? formatMonthDayYear(value)
              : placeholder ?? t('labels.selectDate')}
          </Text>
        </AppPressable>
        {clearable && value ? (
          <AppPressable
            style={styles.clearButton}
            onPress={() => onChange(null)}
            accessibilityLabel={t('a11y.clearField', {
              label: label ?? t('labels.selectDate'),
            })}
          >
            <Icon name="close" size={20} tone="textSecondary" />
          </AppPressable>
        ) : null}
      </View>
      {error ? (
        <Text role="error" tone="error" style={styles.errorText}>
          {error}
        </Text>
      ) : null}
      <Reveal open={open}>
        <MonthCalendar
          selectedDate={value}
          onSelectDate={date => {
            onChange(date);
            setOpen(false);
          }}
          {...(minimumDate ? { minDate: minimumDate } : {})}
          {...(maximumDate ? { maxDate: maximumDate } : {})}
          {...(testID ? { testID: kitTestIDs.datePickerCalendar(testID) } : {})}
        />
      </Reveal>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    marginBottom: theme.spacing.lg,
  },
  input: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: theme.sizes.input.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.inputBackground,
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  clearButton: {
    padding: theme.spacing.sm,
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
}));
