import React from 'react';
import { View, Text } from 'react-native';
import { Control, FieldErrors } from 'react-hook-form';
import { StyleSheet } from 'react-native-unistyles';
import {
  DynamicFormFields,
  FieldDef,
} from '#components/molecules/DynamicFormFields';
import { FormInput } from '#components/molecules/FormInput';
import { FractionInput } from '#components/molecules/FractionInput';

interface QuantitySectionProps {
  control: Control<any>;
  errors: FieldErrors<any>;
  mode: 'add' | 'edit';
  onUnitSelected?: (unitId: string | null, unitName: string | null) => void;
  testID?: string;
  unitTestID?: string;
  // Edit mode stock info (read-only display)
  initialQuantity?: number | null;
  consumedQuantity?: number | null;
  unitSymbol?: string | null;
  // Weight info for stock display
  packageWeight?: number | null;
  weightUnitSymbol?: string | null;
}

export const QuantitySection: React.FC<QuantitySectionProps> = ({
  control,
  errors,
  mode,
  onUnitSelected,
  testID,
  unitTestID,
  initialQuantity,
  consumedQuantity,
  unitSymbol: _unitSymbol,
  packageWeight,
  weightUnitSymbol,
}) => {
  const getFields = (): FieldDef<any>[] => {
    if (mode === 'add') {
      return [
        {
          name: 'quantityInput',
          label: 'Quantity *',
          placeholder: 'e.g., 1, 1 1/4, or 1.5',
          component: FractionInput,
          testID,
        },
        {
          name: 'itemWeight',
          label: 'Net Weight',
          placeholder: 'e.g., 2.2',
          component: FormInput,
          props: { keyboardType: 'decimal-pad', componentType: 'number' },
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
      // Edit mode fields - allow editing quantity, weight, unit, and minimum quantity
      return [
        {
          name: 'quantityInput',
          label: 'Current Quantity',
          placeholder: 'e.g., 1, 1 1/4, or 1.5',
          component: FractionInput,
          testID,
        },
        {
          name: 'itemWeight',
          label: 'Package Weight',
          placeholder: 'e.g., 300',
          component: FormInput,
          props: { keyboardType: 'decimal-pad', componentType: 'number' },
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
    }
  };

  // Format stock display with quantity and optional weight
  const formatStockDisplay = (qty: number | null | undefined) => {
    if (qty == null) return '-';
    if (packageWeight != null) {
      const weightUnit = weightUnitSymbol ? ` ${weightUnitSymbol}` : '';
      // Skip "1 ×" when quantity is 1 - just show weight (industry standard)
      // Use tolerance for floating point comparison
      const isQuantityOne = Math.abs(qty - 1) < 0.001;
      if (isQuantityOne) {
        return `${packageWeight}${weightUnit}`;
      }
      // Show: "2 × 300g" format for qty > 1
      return `${qty} × ${packageWeight}${weightUnit}`;
    }
    // Just quantity, no weight
    return `${qty}`;
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
      {/* Stock info display in edit mode */}
      {mode === 'edit' && (
        <View style={styles.stockInfoContainer}>
          <Text style={styles.stockInfoTitle}>Stock Info</Text>
          <View style={styles.stockInfoRow}>
            <Text style={styles.stockInfoLabel}>Initial:</Text>
            <Text style={styles.stockInfoValue}>
              {formatStockDisplay(initialQuantity)}
            </Text>
          </View>
          <View style={styles.stockInfoRow}>
            <Text style={styles.stockInfoLabel}>Consumed:</Text>
            <Text style={styles.stockInfoValue}>
              {formatStockDisplay(consumedQuantity)}
            </Text>
          </View>
        </View>
      )}
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
  stockInfoContainer: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  stockInfoTitle: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  stockInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.xs,
  },
  stockInfoLabel: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textTertiary,
  },
  stockInfoValue: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    fontWeight: theme.fonts.weight.medium,
  },
}));
