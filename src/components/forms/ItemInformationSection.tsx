import React from 'react';
import {View, Text} from 'react-native';
import {Control, FieldErrors} from 'react-hook-form';
import {StyleSheet} from 'react-native-unistyles';
import {DynamicFormFields, FieldDef} from '#components/molecules/DynamicFormFields';
import {ItemSuggestion} from '#generated';

interface ItemInformationSectionProps {
  control: Control<any>;
  errors: FieldErrors<any>;
  onSelectItem?: (item: ItemSuggestion) => void;
  mode: 'add' | 'edit';
  currentItemName?: string;
}

export const ItemInformationSection: React.FC<ItemInformationSectionProps> = ({
  control,
  errors,
  onSelectItem,
  mode,
  currentItemName,
}) => {
  const getFields = (): FieldDef<any>[] => {
    if (mode === 'add') {
      return [
        {
          name: 'itemName',
          label: 'Item Name',
          placeholder: 'e.g., Rice, Pasta',
          component: 'itemAutocomplete',
          props: {required: true},
          onSelectItem,
        },
        {
          name: 'brand',
          label: 'Brand',
          placeholder: "e.g., Kellogg's",
          component: 'brandAutocomplete',
        },
      ];
    } else {
      // Edit mode - item name is read-only
      return [
        {
          name: 'itemName',
          label: 'Item Name',
          component: () => (
            <View style={styles.readOnlyField}>
              <Text style={styles.readOnlyText}>{currentItemName}</Text>
            </View>
          ),
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