import React from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { Control, FieldErrors } from 'react-hook-form';
import { StyleSheet } from 'react-native-unistyles';
import {
  DynamicFormFields,
  FieldDef,
} from '#components/molecules/DynamicFormFields';
import { FormInput } from '#components/molecules/FormInput';
import { Text } from '#components/atoms/Text';
import type { PantryItemFormData } from './PantryItemForm';

type SuggestedBrand = {
  id: string;
  name: string;
};

interface ItemInformationSectionProps {
  control: Control<PantryItemFormData>;
  errors: FieldErrors<PantryItemFormData>;
  suggestedBrands?: SuggestedBrand[];
  onBrandSelected?: (brandId: string | null) => void;
  onCategorySelected?: (categoryId: string | null) => void;
}

export const ItemInformationSection: React.FC<ItemInformationSectionProps> = ({
  control,
  errors,
  suggestedBrands,
  onBrandSelected,
  onCategorySelected,
}) => {
  const { t } = useTranslation();
  const getFields = (): FieldDef<PantryItemFormData>[] => {
    return [
      {
        name: 'itemName',
        label: t('labels.itemName'),
        placeholder: t('itemForm.placeholderItemName'),
        component: FormInput,
      },
      {
        name: 'category',
        label: t('labels.category'),
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
