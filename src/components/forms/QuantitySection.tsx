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
  testID?: string;
  unitTestID?: string;
  unitSymbol?: string | null;
}

export const QuantitySection: React.FC<QuantitySectionProps> = ({
  control,
  errors,
  mode,
  onUnitSelected,
  testID,
  unitTestID,
}) => {
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

      {/* Row 2: Low Stock Settings */}
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
