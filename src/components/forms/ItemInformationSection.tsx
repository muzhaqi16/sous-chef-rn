import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Control, FieldErrors } from 'react-hook-form';
import { StyleSheet } from 'react-native-unistyles';
import {
  DynamicFormFields,
  FieldDef,
} from '#components/molecules/DynamicFormFields';
import { FormInput } from '#components/molecules/FormInput';
import { ItemSuggestion } from '#/graphql/generated/schemaTypes';
import { Text } from '#components/atoms/Text';
import type { PantryItemFormData } from './PantryItemForm';

type SuggestedBrand = {
  id: string;
  name: string;
};

interface ItemInformationSectionProps {
  control: Control<PantryItemFormData>;
  errors: FieldErrors<PantryItemFormData>;
  onSelectItem?: (item: ItemSuggestion) => void;
  mode: 'add' | 'edit';
  suggestedBrands?: SuggestedBrand[];
  testID?: string;
  onBrandSelected?: (brandId: string | null) => void;
  onCategorySelected?: (categoryId: string | null) => void;
}

export const ItemInformationSection: React.FC<ItemInformationSectionProps> = ({
  control,
  errors,
  onSelectItem,
  mode,
  suggestedBrands,
  testID,
  onBrandSelected,
  onCategorySelected,
}) => {
  const { t } = useTranslation();
  const getFields = (): FieldDef<PantryItemFormData>[] => {
    if (mode === 'add') {
      return [
        {
          name: 'itemName',
          label: t('itemForm.itemName'),
          placeholder: t('itemForm.placeholderItemName'),
          component: 'itemAutocomplete',
          props: { required: true },
          onSelectItem,
          testID,
        },
        {
          name: 'category',
          label: t('itemForm.category'),
          placeholder: t('itemForm.placeholderCategory'),
          component: 'categoryAutocomplete',
          onCategorySelected,
        },
        {
          name: 'brand',
          label: t('itemForm.brand'),
          placeholder: "e.g., Kellogg's",
          component: 'brandAutocomplete',
          props: { suggestedBrands },
        },
      ];
    } else {
      // Edit mode - item name is editable
      return [
        {
          name: 'itemName',
          label: t('itemForm.itemName'),
          placeholder: t('itemForm.placeholderItemName'),
          component: FormInput,
        },
        {
          name: 'category',
          label: t('itemForm.category'),
          placeholder: t('itemForm.placeholderCategory'),
          component: 'categoryAutocomplete',
          onCategorySelected,
        },
        {
          name: 'brand',
          label: t('itemForm.brandOptional'),
          placeholder: "e.g., Kellogg's",
          component: 'brandAutocomplete',
          props: { suggestedBrands, onBrandSelected },
        },
      ];
    }
  };

  return (
    <View style={styles.section}>
      <Text size="lg" weight="semibold" style={styles.sectionTitle}>
        {t('itemForm.itemInformation')}
      </Text>
      <DynamicFormFields
        fields={getFields()}
        control={control}
        errors={errors}
      />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    marginBottom: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
}));
