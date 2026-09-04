import React from 'react';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { Icon } from '#utils/iconUtils';
import { Text } from '#components/atoms/Text';
import { useTranslation } from '#/i18n';
import { commonStyles } from '#/styles/commonStyles';
import { InfoRow } from '#components/atoms/InfoRow';
import { RecurringPattern } from '#/graphql/generated/schemaTypes';
import { listSettingsStyles as styles } from './styles';

interface RecurringSectionProps {
  formatDate: (date?: string | null) => string;
  generating: boolean;
  handleGenerateNext: () => void;
  handleStopRecurring: () => void;
  isOwner: boolean;
  isRecurring: boolean;
  listId: string | undefined;
  nextRecurringDate: string | null;
  patternLabel: (pattern: RecurringPattern | null) => string;
  recurringPattern: RecurringPattern | null;
  setShowPatternPicker: (show: boolean) => void;
}

/** set up or stop auto-regeneration. Owner-only, and only for a list that already exists. */
export const RecurringSection: React.FC<RecurringSectionProps> = ({
  formatDate,
  generating,
  handleGenerateNext,
  handleStopRecurring,
  isOwner,
  isRecurring,
  listId,
  nextRecurringDate,
  patternLabel,
  recurringPattern,
  setShowPatternPicker,
}) => {
  const { t } = useTranslation();
  if (!listId || !isOwner) return null;

  return (
    <View style={commonStyles.settingsSection}>
      <Text style={commonStyles.settingsSectionTitle}>
        {t('shoppingListScreens.recurringSection')}
      </Text>

      {isRecurring ? (
        <>
          <InfoRow
            label={t('shoppingListScreens.recurringPatternLabel')}
            value={patternLabel(recurringPattern)}
          />
          {!!nextRecurringDate && (
            <InfoRow
              label={t('shoppingListScreens.nextOccurrence')}
              value={formatDate(nextRecurringDate)}
            />
          )}
          <Pressable
            style={({ pressed }) => [
              styles.actionRow,
              pressed && styles.pressed,
            ]}
            onPress={handleGenerateNext}
            disabled={generating}
          >
            <Icon name="add-circle-outline" size={20} tone="primary" />
            <Text tone="accent" style={styles.actionText}>
              {t('shoppingListScreens.generateNextList')}
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.actionRow,
              pressed && styles.pressed,
            ]}
            onPress={handleStopRecurring}
          >
            <Icon name="close-circle-outline" size={20} tone="primary" />
            <Text tone="accent" style={styles.actionText}>
              {t('shoppingListScreens.stopRecurring')}
            </Text>
          </Pressable>
        </>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}
          onPress={() => setShowPatternPicker(true)}
        >
          <Icon name="repeat-outline" size={20} tone="primary" />
          <Text tone="accent" style={styles.actionText}>
            {t('shoppingListScreens.makeRecurring')}
          </Text>
        </Pressable>
      )}
    </View>
  );
};
