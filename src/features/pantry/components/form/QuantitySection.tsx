import React from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import type { Control } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { StyleSheet } from 'react-native-unistyles';
import { FormInput } from '#components/atoms/FormInput';
import { FractionInput } from '#components/molecules/FractionInput';
import { UnitAutocompleteField } from '#features/catalog/ui/autocomplete/UnitAutocompleteField';
import { FieldRow } from '#components/atoms/FieldRow';
import type { PantryItemFormData } from './PantryItemForm';
import { SectionHeader } from '#components/atoms/SectionHeader';
import type { UnitType } from '#/graphql/generated/schemaTypes';

interface QuantitySectionProps {
  control: Control<PantryItemFormData>;
  onUnitSelected?: (
    unitId: string | null,
    unitName: string | null,
    unitType?: UnitType | null,
    unitSymbol?: string | null,
  ) => void;
  testID?: string;
  unitTestID?: string;
  unitSymbol?: string | null;
}

export const QuantitySection: React.FC<QuantitySectionProps> = ({
  control,
  onUnitSelected,
  testID,
  unitTestID,
}) => {
  const { t } = useTranslation();
  return (
    <View style={styles.section}>
      <SectionHeader style={styles.sectionTitleSpacing}>
        {t('itemForm.quantityStock')}
      </SectionHeader>

      {/* Each field reads its own `fieldState`: a save's `setError` updates the
          form's `errors` in place, which re-renders nothing that took it as a prop. */}
      {/* Row 1: Quantity + Tracking Unit */}
      <FieldRow>
        <Controller
          control={control}
          name="quantityInput"
          render={({ field: { onChange, value }, fieldState }) => (
            <FractionInput
              label={t('itemForm.quantityCurrent')}
              value={value ?? ''}
              onChangeText={onChange}
              placeholder={t('labels.eG1114')}
              error={fieldState.error?.message}
              testID={testID}
            />
          )}
        />
        <Controller
          control={control}
          name="unit"
          render={({ field: { onChange, value }, fieldState }) => (
            <UnitAutocompleteField
              variant="modal"
              label={t('storageLocationForm.unit')}
              value={value || ''}
              onChangeText={onChange}
              placeholder={t('labels.pcsDozen')}
              onUnitSelected={onUnitSelected}
              error={fieldState.error?.message}
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
          render={({ field: { onChange, onBlur, value }, fieldState }) => (
            <FormInput
              label={t('labels.alertWhenBelow')}
              value={value?.toString() ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder={t('labels.eG2')}
              keyboardType="decimal-pad"
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="restockQuantity"
          render={({ field: { onChange, onBlur, value }, fieldState }) => (
            <FormInput
              label={t('labels.restockTo')}
              value={value?.toString() ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder={t('labels.eG6')}
              keyboardType="decimal-pad"
              error={fieldState.error?.message}
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
  sectionTitleSpacing: {
    marginBottom: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: theme.borderWidth.hairline,
    borderBottomColor: theme.colors.border,
  },
}));
