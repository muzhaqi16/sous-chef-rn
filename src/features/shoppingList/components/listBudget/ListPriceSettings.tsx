import React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';
import { InfoRow } from '#components/atoms/InfoRow';
import { BaseSwitch } from '#components/atoms/BaseSwitch';
import { BaseInput } from '#components/molecules/BaseInput/BaseInput';
import { useTranslation } from '#i18n';
import { commonStyles } from '#styles/commonStyles';
import { formatNumberForInput } from '#utils/formatters/number';
import { useFormatCurrency } from '#domain/money';
import { StoreAutocompleteField } from '#features/catalog/ui/autocomplete/StoreAutocompleteField';
import { shoppingListTestIDs } from '#features/shoppingList/testIDs';
import {
  listPriceSettingsSchema,
  type ListPriceSettingsValues,
} from './listPriceSettingsFormConfig';

type Store = { id: string; name: string };

interface ListPriceSettingsProps {
  currency: string | null;
  budgetAmount: number | null;
  /** The store being shopped, as the list holds it. */
  store: Store | null;
  priceTracking: boolean;
  /** Who may change them; others read the values. */
  canEdit: boolean;
  /** Saves the finished field, once it reads as a budget. */
  onBudgetDone: (input: string) => void;
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
  const money = useFormatCurrency();
  const { control, trigger, getValues, resetField } =
    useForm<ListPriceSettingsValues>({
      resolver: yupResolver(listPriceSettingsSchema),
      // A save, or another member's change, restates a field the user is not
      // editing; each field is set back to clean once it is finished.
      values: {
        budget: formatNumberForInput(budgetAmount),
        store: store?.name ?? '',
      },
      resetOptions: { keepDirtyValues: true },
    });

  const finishBudget = async () => {
    if (!(await trigger('budget'))) return;
    const input = getValues('budget');
    onBudgetDone(input);
    resetField('budget', { defaultValue: input });
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
          <Controller
            control={control}
            name="budget"
            render={({ field, fieldState }) => (
              <BaseInput
                ref={field.ref}
                label={t('shoppingListScreens.budgetAmountLabel')}
                value={field.value}
                onChangeText={field.onChange}
                onEndEditing={() => {
                  void finishBudget();
                }}
                keyboardType="decimal-pad"
                placeholder={t('shoppingListScreens.budgetPlaceholder')}
                errorMessage={fieldState.error?.message}
                testID={shoppingListTestIDs.budgetInput}
              />
            )}
          />
          <Controller
            control={control}
            name="store"
            render={({ field }) => (
              <StoreAutocompleteField
                variant="modal"
                label={t('shoppingListScreens.listStoreLabel')}
                value={field.value}
                onChangeText={field.onChange}
                // Cleared once the emptied field is finished, so retyping a
                // store sends only its pick; a typed name waits for a pick.
                onEndEditing={() => {
                  if (field.value.trim() || !store) return;
                  onPickStore(null);
                  resetField('store', { defaultValue: '' });
                }}
                onStoreSelected={(id, name) => {
                  if (!id || !name) return;
                  onPickStore({ id, name });
                  resetField('store', { defaultValue: name });
                }}
                placeholder={t('shoppingListScreens.storePlaceholder')}
                helperText={t('labels.storeSelectHint')}
                testID={shoppingListTestIDs.listBudgetStore}
              />
            )}
          />
        </>
      ) : (
        <>
          <InfoRow
            label={t('shoppingListScreens.budgetAmountLabel')}
            value={
              budgetAmount === null
                ? t('shoppingListScreens.budgetPlaceholder')
                : money(budgetAmount, currency)
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
