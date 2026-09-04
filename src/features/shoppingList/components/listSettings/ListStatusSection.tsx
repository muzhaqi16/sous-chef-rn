import React from 'react';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { Icon } from '#utils/iconUtils';
import { Text } from '#components/atoms/Text';
import { useTranslation } from '#/i18n';
import { commonStyles } from '#/styles/commonStyles';
import { InfoRow } from '#components/atoms/InfoRow';
import { listSettingsStyles as styles } from './styles';

interface ListStatusSectionProps {
  completedShopDate: string | null;
  completing: boolean;
  formatDate: (date?: string | null) => string;
  handleArchiveToggle: () => void;
  handleToggleComplete: () => void;
  isArchived: boolean;
  isCompleted: boolean;
  isOwner: boolean;
  listId: string | undefined;
  reactivating: boolean;
  statusDisplay: string;
}

/** the complete / reactivate / archive row. Owner-only, and only for a list that already exists. */
export const ListStatusSection: React.FC<ListStatusSectionProps> = ({
  completedShopDate,
  completing,
  formatDate,
  handleArchiveToggle,
  handleToggleComplete,
  isArchived,
  isCompleted,
  isOwner,
  listId,
  reactivating,
  statusDisplay,
}) => {
  const { t } = useTranslation();
  if (!listId || !isOwner) return null;

  return (
    <View style={commonStyles.settingsSection}>
      <Text style={commonStyles.settingsSectionTitle}>
        {t('shoppingListScreens.listStatusSection')}
      </Text>

      <InfoRow label={t('labels.status')} value={statusDisplay} />
      {!!isCompleted && !!completedShopDate && (
        <InfoRow
          label={t('shoppingListScreens.completedOn')}
          value={formatDate(completedShopDate)}
        />
      )}

      {!isArchived && (
        <Pressable
          style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}
          onPress={handleToggleComplete}
          disabled={completing || reactivating}
        >
          <Icon
            name={isCompleted ? 'refresh-outline' : 'checkmark-done-outline'}
            size={20}
            tone="primary"
          />
          <Text tone="accent" style={styles.actionText}>
            {isCompleted
              ? t('shoppingListScreens.reactivateList')
              : t('shoppingListScreens.markComplete')}
          </Text>
        </Pressable>
      )}

      <Pressable
        style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}
        onPress={handleArchiveToggle}
      >
        <Icon
          name={isArchived ? 'arrow-undo-outline' : 'archive-outline'}
          size={20}
          tone="primary"
        />
        <Text tone="accent" style={styles.actionText}>
          {isArchived
            ? t('shoppingListScreens.restoreList')
            : t('labels.archiveList')}
        </Text>
      </Pressable>
    </View>
  );
};
