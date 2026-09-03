import React from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { StyleSheet } from 'react-native-unistyles';
import { detailsPageBaseStyles } from './detailsPageStyles';
import { BottomSheetFormScrollView } from '#components/atoms/BottomSheetFormScrollView';
import { DropdownStack } from '#components/atoms/DropdownStack';
import { FormInput } from '#components/molecules/FormInput';
import { BrandAutocompleteField } from '#features/catalog/ui/autocomplete/BrandAutocompleteField';
import { CategoryAutocompleteField } from '#features/catalog/ui/autocomplete/CategoryAutocompleteField';
import { DatePickerField } from '#components/molecules/DatePickerField';
import { SegmentedControl } from '#components/molecules/SegmentedControl';
import { StorageState } from '#/graphql/generated/schemaTypes';

const STORAGE_STATES = Object.values(StorageState);

export interface MainDetailsPageProps {
  itemName: string;
  setItemName: (value: string) => void;
  /** Validation message for the name field, rendered on the input itself. */
  itemNameError?: string;
  brand: string;
  setBrand: (value: string) => void;
  suggestedBrands?: { id: string; name: string }[];
  handleBrandSelected?: (
    brandId: string | null,
    brandName: string | null,
  ) => void;
  category: string;
  setCategory: (value: string) => void;
  expirationDate: Date | null;
  setExpirationDate: (value: Date | null) => void;
  storageState: StorageState;
  setStorageState: (value: StorageState) => void;
  insets: { bottom: number };
}

export const MainDetailsPage: React.FC<MainDetailsPageProps> = ({
  itemName,
  setItemName,
  itemNameError,
  brand,
  setBrand,
  suggestedBrands,
  handleBrandSelected,
  category,
  setCategory,
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
      {/* Item Name */}
      <FormInput
        label={t('labels.itemName')}
        required
        error={itemNameError}
        value={itemName}
        onChangeText={setItemName}
        placeholder={t('addToPantry.itemNamePlaceholder')}
        useBottomSheetInput
        autoCapitalize="words"
        testID="add-pantry-item-name-input"
      />

      <DropdownStack>
        {/* Brand */}
        <View style={styles.section}>
          <BrandAutocompleteField
            variant="inline"
            label={t('labels.brand')}
            value={brand}
            onChangeText={setBrand}
            placeholder={t('addToPantry.brandPlaceholder')}
            suggestedBrands={suggestedBrands}
            onBrandSelected={handleBrandSelected}
          />
        </View>

        {/* Category */}
        <View style={styles.section}>
          <CategoryAutocompleteField
            variant="inline"
            label={t('labels.category')}
            value={category}
            onChangeText={setCategory}
            placeholder={t('labels.eGDairyProduce')}
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
