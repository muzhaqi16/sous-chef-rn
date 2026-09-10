import React from 'react';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { Icon } from '#utils/iconUtils';
import { Text } from '#components/atoms/Text';
import { useTranslation } from '#/i18n';
import { commonStyles } from '#/styles/commonStyles';
import { InfoRow } from '#components/atoms/InfoRow';
import { listSettingsStyles as styles } from './styles';

interface TemplateSectionProps {
  basedOnTemplate: { id: string; name: string } | null;
  creating: boolean;
  handleCreateFromTemplate: () => void;
  handleSaveAsTemplate: () => void;
  isOwner: boolean;
  isTemplate: boolean;
  listId: string | undefined;
  marking: boolean;
  name: string;
  templateName: string | null;
}

/** save as, or create from, a saved template. Owner-only, and only for a list that already exists. */
export const TemplateSection: React.FC<TemplateSectionProps> = ({
  basedOnTemplate,
  creating,
  handleCreateFromTemplate,
  handleSaveAsTemplate,
  isOwner,
  isTemplate,
  listId,
  marking,
  name,
  templateName,
}) => {
  const { t } = useTranslation();
  if (!listId || !isOwner) return null;

  return (
    <View style={commonStyles.settingsSection}>
      <Text style={commonStyles.settingsSectionTitle}>
        {t('shoppingListScreens.templateSection')}
      </Text>

      {!!basedOnTemplate && (
        <InfoRow
          label={t('shoppingListScreens.basedOnTemplate')}
          value={basedOnTemplate.name}
        />
      )}

      {isTemplate ? (
        <>
          <InfoRow
            label={t('labels.templateName')}
            value={templateName ?? name}
          />
          <Pressable
            style={({ pressed }) => [
              styles.actionRow,
              pressed && styles.pressed,
            ]}
            onPress={handleCreateFromTemplate}
            disabled={creating}
          >
            <Icon name="duplicate-outline" size={20} tone="primary" />
            <Text tone="accent" style={styles.actionText}>
              {t('shoppingListScreens.createFromTemplate')}
            </Text>
          </Pressable>
        </>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}
          onPress={handleSaveAsTemplate}
          disabled={marking}
        >
          <Icon name="bookmark-outline" size={20} tone="primary" />
          <Text tone="accent" style={styles.actionText}>
            {t('labels.saveAsTemplate')}
          </Text>
        </Pressable>
      )}
    </View>
  );
};
