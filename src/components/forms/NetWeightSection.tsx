import React from 'react';
import { View } from 'react-native';
import { Controller, type Control } from 'react-hook-form';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';
import { FormInput } from '#components/molecules/FormInput';
import { UnitAutocompleteField } from '#components/molecules/AutocompleteField/UnitAutocompleteField';
import { FieldRow } from '#components/molecules/FieldRow';
import type { PantryItemFormData } from './PantryItemForm';

interface NetWeightSectionProps {
  control: Control<PantryItemFormData>;
  /** When true, the net-weight inputs are disabled (weight locked after use). */
  isWeightLocked: boolean;
  onNetWeightUnitSelected: (unitId: string | null) => void;
}

/**
 * "Net Weight" page of {@link PantryItemForm} (page index 1). Optional weight +
 * unit used for consumption tracking; locks once the item has been used.
 */
export const NetWeightSection: React.FC<NetWeightSectionProps> = ({
  control,
  isWeightLocked,
  onNetWeightUnitSelected,
}) => {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Net Weight</Text>
      <Text style={styles.sectionDescription}>
        Net weight is used for consumption tracking and is optional.
      </Text>
      <View
        pointerEvents={isWeightLocked ? 'none' : 'auto'}
        style={isWeightLocked ? styles.lockedSection : undefined}
      >
        <FieldRow>
          <Controller
            control={control}
            name="netWeight"
            render={({ field: { onChange, onBlur, value } }) => (
              <FormInput
                label="Net Weight"
                value={value || ''}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="e.g., 14.5"
                keyboardType="decimal-pad"
                editable={!isWeightLocked}
              />
            )}
          />
          <Controller
            control={control}
            name="netWeightUnit"
            render={({ field: { onChange, value } }) => (
              <UnitAutocompleteField
                variant="modal"
                label="Unit"
                value={value || ''}
                onChangeText={onChange}
                onUnitSelected={onNetWeightUnitSelected}
                placeholder="oz, g, ml"
              />
            )}
          />
        </FieldRow>
      </View>
      {!!isWeightLocked && (
        <Text style={styles.lockedHint}>
          Weight locked after use — correct from item details
        </Text>
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
  sectionDescription: {
    fontSize: theme.fonts.size.sm,
    fontStyle: 'italic',
    color: theme.colors.textTertiary,
    marginBottom: theme.spacing.sm,
  },
  lockedSection: {
    opacity: theme.opacity.disabled,
  },
  lockedHint: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textTertiary,
    fontStyle: 'italic',
  },
}));
