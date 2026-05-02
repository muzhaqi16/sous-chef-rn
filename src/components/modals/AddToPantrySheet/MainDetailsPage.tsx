import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { BottomSheetKeyboardAwareScrollView } from '#components/atoms/BottomSheetKeyboardAwareScrollView';
import { FormInput } from '#components/molecules/FormInput';
import { BrandAutocompleteField } from '#components/molecules/AutocompleteField/BrandAutocompleteField';
import { DatePickerField } from '#components/molecules/DatePickerField';
import { SegmentedControl } from '#components/molecules/SegmentedControl';
import { StorageState } from '../../../graphql/generated/schemaTypes';

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
  expirationDate,
  setExpirationDate,
  storageState,
  setStorageState,
  insets,
}) => {
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
        label="Item Name"
        required
        value={itemName}
        onChangeText={setItemName}
        placeholder="e.g., Milk, Eggs, Bread..."
        useBottomSheetInput
        autoCapitalize="words"
        testID="add-pantry-item-name-input"
      />

      {/* Brand */}
      <View style={[styles.section, { zIndex: 10 }]}>
        <BrandAutocompleteField
          variant="inline"
          label="Brand"
          value={brand}
          onChangeText={setBrand}
          placeholder="e.g., Whole Foods, Organic Valley"
          suggestedBrands={suggestedBrands}
          onBrandSelected={handleBrandSelected}
        />
      </View>

      {/* Expiration Date */}
      <DatePickerField
        label="Expiration Date"
        value={expirationDate}
        onChange={setExpirationDate}
        placeholder="Select date"
        minimumDate={new Date()}
      />

      {/* Storage State */}
      <SegmentedControl
        label="Storage"
        options={STORAGE_STATES}
        value={storageState}
        onChange={setStorageState}
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
