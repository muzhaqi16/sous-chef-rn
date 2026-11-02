import React, { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';
import { InfoRow } from '#components/atoms/InfoRow';
import { BaseSwitch } from '#components/atoms/BaseSwitch';
import { BaseInput } from '#components/molecules/BaseInput/BaseInput';
import { useTranslation } from '#/i18n';
import { commonStyles } from '#/styles/commonStyles';
import {
  formatCurrency,
  formatNumberForInput,
} from '#/utils/formatters/number';
import { StoreAutocompleteField } from '#features/catalog/ui/autocomplete/StoreAutocompleteField';
import { shoppingListTestIDs } from '#features/shoppingList/testIDs';

type Store = { id: string; name: string };

interface ListPriceSettingsProps {
  currency: string | null;
  budgetAmount: number | null;
  /** The store being shopped, as the list holds it. */
  store: Store | null;
  priceTracking: boolean;
  /** Who may change them; others read the values. */
  canEdit: boolean;
  /** Saves the finished field; false when it isn't a number. */
  onBudgetDone: (input: string) => boolean;
  /** Saves at once: a picked store, or null once the field is cleared. */
  onPickStore: (store: Store | null) => void;
  onPriceTrackingChange: (value: boolean) => void;
}

/** The list's budget, the store it is shopped at, and whether it asks for prices. */
export const ListPriceSettings: React.FC<ListPriceSettingsProps> = ({
  currency,
  budgetAmount,
  store,
  priceTracking,
  canEdit,
  onBudgetDone,
  onPickStore,
  onPriceTrackingChange,
}) => {
  const { t } = useTranslation();
  const [budgetInput, setBudgetInput] = useState(() =>
    formatNumberForInput(budgetAmount),
  );
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [storeInput, setStoreInput] = useState(store?.name ?? '');
  // A save, or another member's change, restates the field.
  const [budgetSeed, setBudgetSeed] = useState(budgetAmount);
  if (budgetAmount !== budgetSeed) {
    setBudgetSeed(budgetAmount);
    setBudgetInput(formatNumberForInput(budgetAmount));
  }
  const [storeSeed, setStoreSeed] = useState(store?.id);
  if (store?.id !== storeSeed) {
    setStoreSeed(store?.id);
    setStoreInput(store?.name ?? '');
  }

  const finishBudget = () => {
    setBudgetError(
      onBudgetDone(budgetInput)
        ? null
        : t('shoppingListScreens.budget.invalid'),
    );
  };

  return (
    <View
      style={commonStyles.settingsSection}
      testID={shoppingListTestIDs.listPriceSettings}
    >
      <Text role="bodyStrong" style={commonStyles.settingsSectionTitle}>
        {t('shoppingListScreens.listSettings')}
      </Text>

      {canEdit ? (
        <>
          <BaseInput
            label={t('shoppingListScreens.budgetAmountLabel')}
            value={budgetInput}
            onChangeText={setBudgetInput}
            onEndEditing={finishBudget}
            keyboardType="decimal-pad"
            placeholder={t('shoppingListScreens.budgetPlaceholder')}
            errorMessage={budgetError ?? undefined}
            testID={shoppingListTestIDs.budgetInput}
          />
          <StoreAutocompleteField
            variant="modal"
            label={t('shoppingListScreens.listStoreLabel')}
            value={storeInput}
            onChangeText={setStoreInput}
            // Cleared once the emptied field is finished, so retyping a store
            // sends only its pick; a typed name waits for a pick.
            onEndEditing={() => {
              if (!storeInput.trim() && store) onPickStore(null);
            }}
            onStoreSelected={(id, name) => {
              if (id && name) onPickStore({ id, name });
            }}
            placeholder={t('shoppingListScreens.storePlaceholder')}
            helperText={t('labels.storeSelectHint')}
            testID={shoppingListTestIDs.listBudgetStore}
          />
        </>
      ) : (
        <>
          <InfoRow
            label={t('shoppingListScreens.budgetAmountLabel')}
            value={
              budgetAmount === null
                ? t('shoppingListScreens.budgetPlaceholder')
                : formatCurrency(budgetAmount, currency)
            }
          />
          <InfoRow
            label={t('shoppingListScreens.listStoreLabel')}
            value={store?.name ?? t('shoppingListScreens.budget.noStore')}
          />
        </>
      )}
      <Text role="caption" tone="secondary" style={styles.note}>
        {t('shoppingListScreens.listStoreDesc')}
      </Text>

      <View style={commonStyles.settingsRow}>
        <View style={commonStyles.settingsRowInfo}>
          <Text role="bodyStrong">
            {t('shoppingListScreens.priceTrackingLabel')}
          </Text>
          <Text role="caption" style={commonStyles.settingsRowDescription}>
            {t('shoppingListScreens.priceTrackingDesc')}
          </Text>
        </View>
        {canEdit ? (
          <BaseSwitch
            accessibilityLabel={t('shoppingListScreens.priceTrackingLabel')}
            value={priceTracking}
            onValueChange={onPriceTrackingChange}
            testID={shoppingListTestIDs.priceTrackingSwitch}
          />
        ) : (
          <Text role="bodyStrong" tone="secondary">
            {priceTracking ? t('labels.yes') : t('labels.no')}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  note: {
    marginTop: theme.spacing.sm,
  },
}));
