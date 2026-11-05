import { pantryTestIDs } from '#features/pantry/testIDs';
import React, { useRef } from 'react';
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
import type { ThemedBottomSheetTextInputRef } from '#components/atoms/themedComponents';

const STORAGE_STATES = Object.values(StorageState);

export interface MainDetailsPageProps {
  itemName: string;
  setItemName: (value: string) => void;
  /** Validation message for the name field, rendered on the input itself. */
  itemNameError?: string;
  /** Item Name's input, which a failed submit focuses. */
  itemNameRef?: React.Ref<ThemedBottomSheetTextInputRef>;
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
  itemNameRef,
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
  // Return moves through the text fields in order: name, brand, category.
  const brandRef = useRef<ThemedBottomSheetTextInputRef>(null);
  const categoryRef = useRef<ThemedBottomSheetTextInputRef>(null);
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
        sheetRef={itemNameRef}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => brandRef.current?.focus()}
        value={itemName}
        onChangeText={setItemName}
        placeholder={t('addToPantry.itemNamePlaceholder')}
        useBottomSheetInput
        autoCapitalize="words"
        testID={pantryTestIDs.addDetailsNameInput}
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
            chaining={{
              inputRef: brandRef,
              returnKeyType: 'next',
              onSubmitEditing: () => categoryRef.current?.focus(),
            }}
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
            chaining={{ inputRef: categoryRef, returnKeyType: 'done' }}
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
