import { pantryTestIDs } from '#features/pantry/testIDs';
import React from 'react';
import {
  Controller,
  type Control,
  type UseFormSetFocus,
} from 'react-hook-form';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { StyleSheet } from 'react-native-unistyles';
import { detailsPageBaseStyles } from './detailsPageStyles';
import { BottomSheetFormScrollView } from '#components/atoms/BottomSheetFormScrollView';
import { DropdownStack } from '#components/atoms/DropdownStack';
import { FormInput } from '#components/atoms/FormInput';
import { BrandAutocompleteField } from '#features/catalog/ui/autocomplete/BrandAutocompleteField';
import { CategoryAutocompleteField } from '#features/catalog/ui/autocomplete/CategoryAutocompleteField';
import { DatePickerField } from '#components/molecules/DatePickerField';
import { SegmentedControl } from '#components/molecules/SegmentedControl';
import { StorageState } from '#/graphql/generated/schemaTypes';
import type { AddPantryItemFormData } from '#features/pantry/types';

const STORAGE_STATES = Object.values(StorageState);

export interface MainDetailsPageProps {
  /**
   * The name, brand and category render through it, so react-hook-form holds
   * their inputs: a failed submit focuses the first one in error.
   */
  control: Control<AddPantryItemFormData>;
  /** Moves the return key on to the next field, by name. */
  setFocus: UseFormSetFocus<AddPantryItemFormData>;
  suggestedBrands?: { id: string; name: string }[];
  handleBrandSelected?: (
    brandId: string | null,
    brandName: string | null,
  ) => void;
  expirationDate: Date | null;
  setExpirationDate: (value: Date | null) => void;
  storageState: StorageState;
  setStorageState: (value: StorageState) => void;
  insets: { bottom: number };
}

export const MainDetailsPage: React.FC<MainDetailsPageProps> = ({
  control,
  setFocus,
  suggestedBrands,
  handleBrandSelected,
  expirationDate,
  setExpirationDate,
  storageState,
  setStorageState,
  insets,
}) => {
  const { t } = useTranslation();
  // Keyed off the enum like every other StorageState picker, so `NONE` — which
  // `Object.values(StorageState)` puts in this list — gets a label instead of
  // falling through to the raw "NONE". `enumKeyCoverage.test.ts` fails if
  // codegen adds a member this namespace lacks.
  const formatStorageStateLabel = (state: StorageState) =>
    t(`storageState.${state}`);
  return (
    <BottomSheetFormScrollView
      key="main"
      style={styles.page}
      contentContainerStyle={[
        styles.pageContent,
        { paddingBottom: insets.bottom + 20 },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Item Name. Return moves through name, brand and category. */}
      <Controller
        control={control}
        name="itemName"
        render={({ field: { value, onChange, ref }, fieldState }) => (
          <FormInput
            label={t('labels.itemName')}
            required
            error={fieldState.error?.message}
            ref={ref}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => setFocus('brand')}
            value={value}
            onChangeText={onChange}
            placeholder={t('addToPantry.itemNamePlaceholder')}
            useBottomSheetInput
            autoCapitalize="words"
            testID={pantryTestIDs.addDetailsNameInput}
          />
        )}
      />

      <DropdownStack>
        {/* Brand */}
        <View style={styles.section}>
          <Controller
            control={control}
            name="brand"
            render={({ field: { value, onChange, ref } }) => (
              <BrandAutocompleteField
                variant="inline"
                label={t('labels.brand')}
                value={value}
                onChangeText={onChange}
                placeholder={t('addToPantry.brandPlaceholder')}
                suggestedBrands={suggestedBrands}
                onBrandSelected={handleBrandSelected}
                chaining={{
                  inputRef: ref,
                  returnKeyType: 'next',
                  onSubmitEditing: () => setFocus('category'),
                }}
              />
            )}
          />
        </View>

        {/* Category */}
        <View style={styles.section}>
          <Controller
            control={control}
            name="category"
            render={({ field: { value, onChange, ref } }) => (
              <CategoryAutocompleteField
                variant="inline"
                label={t('labels.category')}
                value={value}
                onChangeText={onChange}
                placeholder={t('labels.eGDairyProduce')}
                chaining={{ inputRef: ref, returnKeyType: 'done' }}
              />
            )}
          />
        </View>

        {/* Expiration Date */}
        <DatePickerField
          label={t('labels.expirationDate')}
          value={expirationDate}
          onChange={setExpirationDate}
          placeholder={t('labels.selectDate')}
          minimumDate={new Date()}
        />

        {/* Storage State */}
        <SegmentedControl
          label={t('labels.storage')}
          options={STORAGE_STATES}
          value={storageState}
          onChange={setStorageState}
          formatLabel={formatStorageStateLabel}
        />
      </DropdownStack>
    </BottomSheetFormScrollView>
  );
};

const styles = StyleSheet.create(theme => ({
  ...detailsPageBaseStyles(theme),
}));
