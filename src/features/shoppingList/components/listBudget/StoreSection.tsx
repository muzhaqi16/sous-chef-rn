import React, { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';
import { InfoRow } from '#components/atoms/InfoRow';
import { useTranslation } from '#/i18n';
import { commonStyles } from '#/styles/commonStyles';
import { StoreAutocompleteField } from '#features/catalog/ui/autocomplete/StoreAutocompleteField';
import { shoppingListTestIDs } from '#features/shoppingList/testIDs';

interface StoreSectionProps {
  /** The store being shopped, as the list holds it. */
  store: { id: string; name: string } | null;
  /** Who may pick it; others read it. */
  canEdit: boolean;
  /** Saves at once: a picked store, or null once the field is cleared. */
  onPick: (store: { id: string; name: string } | null) => void;
}

/** The store the list is shopped at, where a ticked line's price is recorded. */
export const StoreSection: React.FC<StoreSectionProps> = ({
  store,
  canEdit,
  onPick,
}) => {
  const { t } = useTranslation();
  const [input, setInput] = useState(store?.name ?? '');
  // A pick, or another member's, restates the field.
  const [seededFrom, setSeededFrom] = useState(store?.id);
  if (store?.id !== seededFrom) {
    setSeededFrom(store?.id);
    setInput(store?.name ?? '');
  }

  return (
    <View style={commonStyles.settingsSection}>
      <Text role="bodyStrong" style={commonStyles.settingsSectionTitle}>
        {t('labels.store')}
      </Text>
      {canEdit ? (
        <StoreAutocompleteField
          variant="modal"
          label={t('shoppingListScreens.listStoreLabel')}
          value={input}
          onChangeText={setInput}
          // Cleared once the emptied field is finished, so retyping a store sends
          // only its pick; a typed name waits for a pick.
          onEndEditing={() => {
            if (!input.trim() && store) onPick(null);
          }}
          onStoreSelected={(id, name) => {
            if (id && name) onPick({ id, name });
          }}
          placeholder={t('shoppingListScreens.storePlaceholder')}
          helperText={t('labels.storeSelectHint')}
          testID={shoppingListTestIDs.listBudgetStore}
        />
      ) : (
        <InfoRow
          label={t('shoppingListScreens.listStoreLabel')}
          value={store?.name ?? t('shoppingListScreens.budget.noStore')}
        />
      )}
      <Text role="caption" tone="secondary" style={styles.note}>
        {t('shoppingListScreens.listStoreDesc')}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  note: {
    marginTop: theme.spacing.sm,
  },
}));
