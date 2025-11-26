import React from 'react';
import { View, Text } from 'react-native';
import { Control, FieldErrors } from 'react-hook-form';
import { StyleSheet } from 'react-native-unistyles';
import {
  DynamicFormFields,
  FieldDef,
} from '#components/molecules/DynamicFormFields';
import { FormInput } from '#components/molecules/FormInput';
import { FormCheckbox } from '#components/molecules/FormCheckbox';
import { FractionInput } from '#components/molecules/FractionInput';

interface QuantitySectionProps {
  control: Control<any>;
  errors: FieldErrors<any>;
  mode: 'add' | 'edit';
  quantity: number;
  quantityInput: string;
  unit: string;
  itemWeight?: number;
  isAutoReorder?: boolean;
  onQuantityInputChange: (text: string) => void;
  onIncrementQuantity: () => void;
  onDecrementQuantity: () => void;
  onUnitSelected?: (unitId: string | null) => void;
  onUnitChange?: (unit: string) => void;
  testID?: string;
  unitTestID?: string;
}

export const QuantitySection: React.FC<QuantitySectionProps> = ({
  control,
  errors,
  mode,
  quantityInput,
  isAutoReorder,
  onQuantityInputChange,
  onUnitSelected,
  testID,
  unitTestID,
}) => {
  const getFields = (): FieldDef<any>[] => {
    if (mode === 'add') {
      return [
        {
          name: 'quantityInput',
          label: 'Quantity',
          component: () => (
            <FractionInput
              label="Quantity *"
              value={quantityInput}
              onChangeText={onQuantityInputChange}
              placeholder="e.g., 1, 1 1/4, or 1.5"
              testID={testID}
            />
          ),
        },
        {
          name: 'itemWeight',
          label: 'Weight',
          placeholder: 'e.g., 2.2',
          component: FormInput,
          props: { keyboardType: 'decimal-pad' },
        },
        {
          name: 'unit',
          label: 'Unit',
          placeholder: 'kg, lbs, pcs',
          component: 'unitAutocomplete',
          onUnitSelected,
          testID: unitTestID,
        },
        {
          name: 'minimumQuantity',
          label: 'Minimum Quantity',
          placeholder: 'Alert when below this quantity',
          component: FormInput,
          props: { keyboardType: 'numeric' },
        },
      ];
    } else {
      // Edit mode fields
      const baseFields: FieldDef<any>[] = [
        {
          name: 'quantityInput',
          label: 'Current Quantity',
          component: () => (
            <FractionInput
              label="Current Quantity *"
              value={quantityInput}
              onChangeText={onQuantityInputChange}
              placeholder="e.g., 1, 1 1/4, or 1.5"
            />
          ),
        },
        {
          name: 'itemWeight',
          label: 'Net Weight',
          placeholder: 'e.g., 2.2',
          component: FormInput,
          props: { keyboardType: 'decimal-pad' },
        },
        {
          name: 'unit',
          label: 'Unit',
          placeholder: 'kg, lbs, pcs',
          component: 'unitAutocomplete',
          onUnitSelected,
          testID: unitTestID,
        },
        {
          name: 'reservedQuantity',
          label: 'Minimum Stock Level',
          placeholder: 'Alert when below this quantity',
          component: FormInput,
          props: { keyboardType: 'numeric' },
        },
        {
          name: 'isAutoReorder',
          label: 'Auto Reorder',
          component: FormCheckbox,
          props: { componentType: 'checkbox' },
        },
      ];

      if (isAutoReorder) {
        baseFields.push({
          name: 'autoReorderPoint',
          label: 'Reorder Point',
          placeholder: 'Reorder when quantity reaches...',
          component: FormInput,
          props: { keyboardType: 'numeric' },
        });
      }

      return baseFields;
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        {mode === 'add' ? 'Quantity & Unit' : 'Quantity & Stock'}
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
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  quantityContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
  },
  unitText: {
    fontSize: theme.fonts.size.base,
    color: theme.colors.textSecondary,
    textAlign: 'center',
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
  unitInputContainer: {
    flex: 1,
  },
  unitDisplayField: {
    backgroundColor: theme.colors.surfaceVariant,
    color: theme.colors.textSecondary,
  },
  unitContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surface,
    minHeight: 44,
  },
  unitDisplay: {
    fontSize: theme.fonts.size.base,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
}));
