import React from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { Control, FieldErrors } from 'react-hook-form';
import { StyleSheet } from 'react-native-unistyles';
import {
  DynamicFormFields,
  FieldDef,
} from '#components/molecules/DynamicFormFields';
import { FormInput } from '#components/atoms/FormInput';
import type { PantryItemFormData } from './PantryItemForm';
import { SectionHeader } from '#components/atoms/SectionHeader';

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
        props: { onCategorySelected },
      },
      {
        name: 'brand',
        label: t('itemForm.brandOptional'),
        placeholder: t('itemForm.placeholderBrand'),
        component: 'brandAutocomplete',
        props: { suggestedBrands, onBrandSelected },
      },
    ];
  };

  return (
    <View style={styles.section}>
      <SectionHeader style={styles.sectionTitleSpacing}>
        {t('itemForm.itemInformation')}
      </SectionHeader>
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
  sectionTitleSpacing: {
    marginBottom: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: theme.borderWidth.hairline,
    borderBottomColor: theme.colors.border,
  },
}));
