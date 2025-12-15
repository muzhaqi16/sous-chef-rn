import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { Control, FieldErrors } from 'react-hook-form';
import { StyleSheet } from 'react-native-unistyles';
import {
  DynamicFormFields,
  FieldDef,
} from '#components/molecules/DynamicFormFields';
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
  currentItemName?: string;
  suggestedBrands?: SuggestedBrand[];
  testID?: string;
}

const createReadOnlyComponent = (itemName: string) => {
  const Component: React.FC = () => (
    <View style={styles.readOnlyField}>
      <Text style={styles.readOnlyText}>{itemName}</Text>
    </View>
  );
  Component.displayName = 'ReadOnlyItemNameBound';
  return Component;
};
export const ItemInformationSection: React.FC<ItemInformationSectionProps> = ({
  control,
  errors,
  onSelectItem,
  mode,
  currentItemName,
  suggestedBrands,
  testID,
}) => {
  const readOnlyComponent = useMemo(
    () =>
      currentItemName ? createReadOnlyComponent(currentItemName) : () => null,
    [currentItemName],
  );

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
      // Edit mode - item name is read-only
      return [
        {
          name: 'itemName',
          label: 'Item Name',
          component: readOnlyComponent,
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
  readOnlyField: {
    padding: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surfaceVariant,
  },
  readOnlyText: {
    fontSize: theme.fonts.size.base,
    color: theme.colors.textTertiary,
  },
}));
