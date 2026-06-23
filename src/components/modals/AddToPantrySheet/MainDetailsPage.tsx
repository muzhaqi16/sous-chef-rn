import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native-unistyles';
import { BottomSheetKeyboardAwareScrollView } from '#components/atoms/BottomSheetKeyboardAwareScrollView';
import { FormInput } from '#components/molecules/FormInput';
import { BrandAutocompleteField } from '#components/molecules/AutocompleteField/BrandAutocompleteField';
import { CategoryAutocompleteField } from '#components/molecules/AutocompleteField/CategoryAutocompleteField';
import { DatePickerField } from '#components/molecules/DatePickerField';
import { SegmentedControl } from '#components/molecules/SegmentedControl';
import { StorageState } from '#/graphql/generated/schemaTypes';

const STORAGE_STATES = Object.values(StorageState);

export interface MainDetailsPageProps {
  itemName: string;
  setItemName: (value: string) => void;
  brand: string;
  setBrand: (value: string) => void;
  suggestedBrands: { id: string; name: string }[];
  handleBrandSelected: (
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
  const formatStorageStateLabel = (state: StorageState) => {
    switch (state) {
      case StorageState.Ambient:
        return t('addToPantry.stateAmbient');
      case StorageState.Refrigerated:
        return t('addToPantry.stateRefrigerated');
      case StorageState.Frozen:
        return t('addToPantry.stateFrozen');
      default:
        return state;
    }
  };
  return (
    <BottomSheetKeyboardAwareScrollView
      key="main"
      style={styles.page}
      contentContainerStyle={[
        styles.pageContent,
        { paddingBottom: insets.bottom + 20 },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      bottomOffset={16}
    >
      {/* Item Name */}
      <FormInput
        label={t('addToPantry.itemName')}
        required
        value={itemName}
        onChangeText={setItemName}
        placeholder={t('addToPantry.itemNamePlaceholder')}
        useBottomSheetInput
        autoCapitalize="words"
        testID="add-pantry-item-name-input"
      />

      {/* Brand */}
      <View style={[styles.section, { zIndex: 10 }]}>
        <BrandAutocompleteField
          variant="inline"
          label={t('addToPantry.brand')}
          value={brand}
          onChangeText={setBrand}
          placeholder={t('addToPantry.brandPlaceholder')}
          suggestedBrands={suggestedBrands}
          onBrandSelected={handleBrandSelected}
        />
      </View>

      {/* Category */}
      <View style={[styles.section, { zIndex: 9 }]}>
        <CategoryAutocompleteField
          variant="inline"
          label={t('addToPantry.category')}
          value={category}
          onChangeText={setCategory}
          placeholder={t('addToPantry.categoryPlaceholder')}
        />
      </View>

      {/* Expiration Date */}
      <DatePickerField
        label={t('addToPantry.expirationDate')}
        value={expirationDate}
        onChange={setExpirationDate}
        placeholder={t('addToPantry.expirationPlaceholder')}
        minimumDate={new Date()}
      />

      {/* Storage State */}
      <SegmentedControl
        label={t('addToPantry.storage')}
        options={STORAGE_STATES}
        value={storageState}
        onChange={setStorageState}
        formatLabel={formatStorageStateLabel}
      />
    </BottomSheetKeyboardAwareScrollView>
  );
};

const styles = StyleSheet.create(theme => ({
  page: {
    flex: 1,
    minHeight: '100%',
    flexGrow: 1,
  },
  pageContent: {
    padding: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    flexGrow: 1,
  },
  section: {
    marginBottom: theme.spacing.sm,
  },
}));
