import React from 'react';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { Icon } from '#utils/iconUtils';
import { Text } from '#components/atoms/Text';
import { useTranslation } from '#/i18n';
import { commonStyles } from '#/styles/commonStyles';
import { DatePickerField } from '#components/molecules/DatePickerField';
import { listSettingsStyles as styles } from './styles';

interface ReminderSectionProps {
  handleClearReminder: () => void;
  handleSetReminderDate: (date: Date | null) => void;
  isOwner: boolean;
  listId: string | undefined;
  reminderDate: string | null;
  reminderEnabled: boolean;
}

/** set or clear a shopping reminder. Owner-only, and only for a list that already exists. */
export const ReminderSection: React.FC<ReminderSectionProps> = ({
  handleClearReminder,
  handleSetReminderDate,
  isOwner,
  listId,
  reminderDate,
  reminderEnabled,
}) => {
  const { t } = useTranslation();
  if (!listId || !isOwner) return null;

  return (
    <View style={commonStyles.settingsSection}>
      <Text style={commonStyles.settingsSectionTitle}>
        {t('shoppingListScreens.reminderSection')}
      </Text>

      <DatePickerField
        label={t('shoppingListScreens.reminderDateLabel')}
        value={reminderDate ? new Date(reminderDate) : null}
        onChange={handleSetReminderDate}
        minimumDate={new Date()}
        placeholder={t('shoppingListScreens.setReminderPlaceholder')}
      />

      {!!reminderEnabled && (
        <Pressable
          style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}
          onPress={handleClearReminder}
        >
          <Icon name="notifications-off-outline" size={20} tone="primary" />
          <Text tone="accent" style={styles.actionText}>
            {t('shoppingListScreens.clearReminder')}
          </Text>
        </Pressable>
      )}
    </View>
  );
};
