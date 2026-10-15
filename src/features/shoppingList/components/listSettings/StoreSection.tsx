import React from 'react';
import { View } from 'react-native';
import { Text } from '#components/atoms/Text';
import { useTranslation } from '#/i18n';
import { commonStyles } from '#/styles/commonStyles';
import { StoreAutocompleteField } from '#features/catalog/ui/autocomplete/StoreAutocompleteField';
import { shoppingListTestIDs } from '#features/shoppingList/testIDs';
import { listSettingsStyles as styles } from './styles';

interface StoreSectionProps {
  isOwner: boolean;
  listId: string | undefined;
  storeInput: string;
  setStoreInput: (value: string) => void;
  handleStoreSelected: (id: string | null, name: string | null) => void;
}

/** The store the list is shopped at. Owner-only, and only for a list that already exists. */
export const StoreSection: React.FC<StoreSectionProps> = ({
  isOwner,
  listId,
  storeInput,
  setStoreInput,
  handleStoreSelected,
}) => {
  const { t } = useTranslation();
  if (!listId || !isOwner) return null;

  return (
    <View style={commonStyles.settingsSection}>
      <Text role="bodyStrong" style={commonStyles.settingsSectionTitle}>
        {t('labels.store')}
      </Text>
      <StoreAutocompleteField
        variant="modal"
        label={t('shoppingListScreens.listStoreLabel')}
        value={storeInput}
        onChangeText={setStoreInput}
        onStoreSelected={handleStoreSelected}
        placeholder={t('shoppingListScreens.storePlaceholder')}
        helperText={t('labels.storeSelectHint')}
        testID={shoppingListTestIDs.listSettingsStore}
      />
      <Text role="caption" tone="secondary" style={styles.fieldNote}>
        {t('shoppingListScreens.listStoreDesc')}
      </Text>
    </View>
  );
};
