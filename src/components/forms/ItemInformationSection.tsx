import React from 'react';
import { View, Text } from 'react-native';
import { Control, FieldErrors } from 'react-hook-form';
import { StyleSheet } from 'react-native-unistyles';
import {
  DynamicFormFields,
  FieldDef,
} from '#components/molecules/DynamicFormFields';
import { FormInput } from '#components/molecules/FormInput';
import { ItemSuggestion } from '#generated';

type SuggestedBrand = {
  id: string;
  name: string;
};

interface ItemInformationSectionProps {
  control: Control<any>;
  errors: FieldErrors<any>;
  onSelectItem?: (item: ItemSuggestion) => void;
  mode: 'add' | 'edit';
  suggestedBrands?: SuggestedBrand[];
  testID?: string;
  onBrandSelected?: (brandId: string | null) => void;
}

export const ItemInformationSection: React.FC<ItemInformationSectionProps> = ({
  control,
  errors,
  onSelectItem,
  mode,
  suggestedBrands,
  testID,
  onBrandSelected,
}) => {
  const getFields = (): FieldDef<any>[] => {
    if (mode === 'add') {
      return [
        {
          name: 'itemName',
          label: 'Item Name',
          placeholder: 'e.g., Rice, Pasta',
          component: 'itemAutocomplete',
          props: { required: true },
          onSelectItem,
          testID,
        },
        {
          name: 'brand',
          label: 'Brand',
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
          label: 'Item Name',
          placeholder: 'e.g., Rice, Pasta',
          component: FormInput,
        },
        {
          name: 'brand',
          label: 'Brand (optional)',
          placeholder: "e.g., Kellogg's",
          component: 'brandAutocomplete',
          props: { suggestedBrands, onBrandSelected },
        },
      ];
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Item Information</Text>
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
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
}));
