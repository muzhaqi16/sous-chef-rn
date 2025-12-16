import React from 'react';
import { View, Text } from 'react-native';
import { Control, Controller, FieldErrors } from 'react-hook-form';
import { StyleSheet } from 'react-native-unistyles';
import { FormInput } from '#components/molecules/FormInput';
import { FractionInput } from '#components/molecules/FractionInput';
import { UnitsAutocompleteInput } from '#components/molecules/UnitsAutocompleteInput';
import { FieldRow } from '#components/molecules/FieldRow';

interface QuantitySectionProps {
  control: Control<any>;
  errors: FieldErrors<any>;
  mode: 'add' | 'edit';
  onUnitSelected?: (unitId: string | null, unitName: string | null, unitType?: string | null) => void;
  onWeightUnitSelected?: (unitId: string | null, unitName: string | null, unitType?: string | null) => void;
  testID?: string;
  unitTestID?: string;
  weightUnitTestID?: string;
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
  onWeightUnitSelected,
  testID,
  unitTestID,
  weightUnitTestID,
  initialQuantity,
  consumedQuantity,
  unitSymbol: _unitSymbol,
  packageWeight,
  weightUnitSymbol,
}) => {
  // Format stock display with quantity and optional weight
  const formatStockDisplay = (qty: number | null | undefined) => {
    if (qty == null) return '-';
    if (packageWeight != null) {
      const weightUnit = weightUnitSymbol ? ` ${weightUnitSymbol}` : '';
      // Skip "1 ×" when quantity is 1 - just show weight (industry standard)
      const isQuantityOne = Math.abs(qty - 1) < 0.001;
      if (isQuantityOne) {
        return `${packageWeight}${weightUnit}`;
      }
      return `${qty} × ${packageWeight}${weightUnit}`;
    }
    return `${qty}`;
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        {mode === 'add' ? 'Quantity & Unit' : 'Quantity & Stock'}
      </Text>

      {/* Row 1: Quantity + Tracking Unit */}
      <FieldRow>
        <Controller
          control={control}
          name="quantityInput"
          render={({ field: { onChange, value } }) => (
            <FractionInput
              label={mode === 'add' ? 'Quantity *' : 'Current Quantity'}
              value={value}
              onChangeText={onChange}
              placeholder="e.g., 1, 1 1/4"
              error={errors.quantityInput?.message?.toString()}
              testID={testID}
            />
          )}
        />
        <Controller
          control={control}
          name="unit"
          render={({ field: { onChange, value } }) => (
            <UnitsAutocompleteInput
              label="Unit"
              value={value || ''}
              onChangeText={onChange}
              placeholder="pcs, dozen"
              onUnitSelected={onUnitSelected}
              testID={unitTestID}
            />
          )}
        />
      </FieldRow>

      {/* Row 2: Package Weight + Weight Unit */}
      <FieldRow>
        <Controller
          control={control}
          name="itemWeight"
          render={({ field: { onChange, value } }) => (
            <FractionInput
              label="Package Weight"
              value={value?.toString() || ''}
              onChangeText={onChange}
              placeholder="e.g., 1/4, 300"
              error={errors.itemWeight?.message?.toString()}
            />
          )}
        />
        <Controller
          control={control}
          name="weightUnit"
          render={({ field: { onChange, value } }) => (
            <UnitsAutocompleteInput
              label="Weight Unit"
              value={value || ''}
              onChangeText={onChange}
              placeholder="g, kg, oz"
              onUnitSelected={onWeightUnitSelected}
              testID={weightUnitTestID}
            />
          )}
        />
      </FieldRow>

      {/* Row 3: Low Stock Settings */}
      <FieldRow>
        <Controller
          control={control}
          name="minQuantity"
          render={({ field: { onChange, onBlur, value } }) => (
            <FormInput
              label="Alert When Below"
              value={value?.toString() || ''}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="e.g., 2"
              keyboardType="decimal-pad"
              error={errors.minQuantity?.message?.toString()}
            />
          )}
        />
        <Controller
          control={control}
          name="restockQuantity"
          render={({ field: { onChange, onBlur, value } }) => (
            <FormInput
              label="Restock To"
              value={value?.toString() || ''}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="e.g., 6"
              keyboardType="decimal-pad"
              error={errors.restockQuantity?.message?.toString()}
            />
          )}
        />
      </FieldRow>

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
