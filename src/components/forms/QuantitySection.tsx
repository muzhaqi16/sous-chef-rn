import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Control, Controller, FieldErrors } from 'react-hook-form';
import { StyleSheet } from 'react-native-unistyles';
import { FormInput } from '#components/molecules/FormInput';
import { FractionInput } from '#components/molecules/FractionInput';
import { UnitAutocompleteField } from '#components/molecules/AutocompleteField/UnitAutocompleteField';
import { FieldRow } from '#components/molecules/FieldRow';
import { Text } from '#components/atoms/Text';
import type { PantryItemFormData } from './PantryItemForm';

interface QuantitySectionProps {
  control: Control<PantryItemFormData>;
  errors: FieldErrors<PantryItemFormData>;
  mode: 'add' | 'edit';
  onUnitSelected?: (
    unitId: string | null,
    unitName: string | null,
    unitType?: string | null,
    unitSymbol?: string | null,
  ) => void;
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
  const { t } = useTranslation();
  return (
    <View style={styles.section}>
      <Text size="lg" weight="semibold" style={styles.sectionTitle}>
        {mode === 'add'
          ? t('itemForm.quantityUnit')
          : t('itemForm.quantityStock')}
      </Text>

      {/* Row 1: Quantity + Tracking Unit */}
      <FieldRow>
        <Controller
          control={control}
          name="quantityInput"
          render={({ field: { onChange, value } }) => (
            <FractionInput
              label={mode === 'add' ? 'Quantity *' : 'Current Quantity'}
              value={value ?? ''}
              onChangeText={onChange}
              placeholder={t('itemForm.placeholderQuantity')}
              error={errors.quantityInput?.message?.toString()}
              testID={testID}
            />
          )}
        />
        <Controller
          control={control}
          name="unit"
          render={({ field: { onChange, value } }) => (
            <UnitAutocompleteField
              variant="modal"
              label={t('itemForm.unit')}
              value={value || ''}
              onChangeText={onChange}
              placeholder={t('itemForm.placeholderUnit')}
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
              label={t('itemForm.alertWhenBelow')}
              value={value?.toString() || ''}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder={t('itemForm.placeholderAlertBelow')}
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
              label={t('itemForm.restockTo')}
              value={value?.toString() || ''}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder={t('itemForm.placeholderRestockTo')}
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
    marginBottom: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
}));
