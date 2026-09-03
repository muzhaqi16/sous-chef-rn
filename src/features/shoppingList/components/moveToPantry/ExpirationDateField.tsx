import React from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { ThemedDateTimePicker } from '#components/atoms/themedComponents';
import { Icon } from '#utils/iconUtils';
import { Text } from '#components/atoms/Text';
import { formatShortDate } from '#/utils/formatters/date';

interface ExpirationDateFieldProps {
  expirationDate: Date | undefined;
  showPicker: boolean;
  onOpenPicker: () => void;
  onChange: (event: DateTimePickerEvent, date?: Date) => void;
  onClear: () => void;
}

/**
 * Optional expiration-date picker row for {@link MoveToPantryModal}.
 */
export const ExpirationDateField: React.FC<ExpirationDateFieldProps> = ({
  expirationDate,
  showPicker,
  onOpenPicker,
  onChange,
  onClear,
}) => {
  const { t } = useTranslation();

  return (
    <View style={styles.section}>
      <Text size="md" weight="medium" style={styles.sectionLabel}>
        {t('labels.expirationDate')}
      </Text>
      <View style={styles.dateRow}>
        <AppPressable style={styles.dateInput} onPress={onOpenPicker}>
          <Icon name="calendar-outline" size={20} tone="textSecondary" />
          <Text style={styles.dateText}>
            {expirationDate
              ? formatShortDate(expirationDate)
              : t('labels.selectDate')}
          </Text>
        </AppPressable>
        {!!expirationDate && (
          <AppPressable style={styles.clearDateButton} onPress={onClear}>
            <Icon name="close" size={20} tone="textSecondary" />
          </AppPressable>
        )}
      </View>
      {!!showPicker && (
        <ThemedDateTimePicker
          value={expirationDate || new Date()}
          mode="date"
          minimumDate={new Date()}
          onChange={onChange}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionLabel: {
    marginBottom: theme.spacing.sm,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  dateInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
  },
  dateText: {
    fontSize: theme.fonts.size.base,
    color: theme.colors.textPrimary,
    marginLeft: theme.spacing.md,
  },
  clearDateButton: {
    padding: theme.spacing.sm,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
