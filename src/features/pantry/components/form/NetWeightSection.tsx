import React from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { Controller, type Control } from 'react-hook-form';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';
import { FormInput } from '#components/molecules/FormInput';
import { UnitAutocompleteField } from '#features/catalog/ui/autocomplete/UnitAutocompleteField';
import { FieldRow } from '#components/molecules/FieldRow';
import type { PantryItemFormData } from './PantryItemForm';
import { localizeNumericHint } from '#/utils/formatters/number';

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
  const { t } = useTranslation();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('labels.netWeight')}</Text>
      <Text style={styles.sectionDescription}>
        {t('labels.netWeightIsUsedForConsumptionTrackingAndIsOptional')}
      </Text>
      <View
        pointerEvents={isWeightLocked ? 'none' : 'auto'}
        style={isWeightLocked ? styles.lockedSection : undefined}
      >
        <FieldRow>
          <Controller
            control={control}
            name="netWeight"
            render={({ field: { onChange, onBlur, value }, fieldState }) => (
              <FormInput
                label={t('labels.netWeight')}
                value={value || ''}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder={localizeNumericHint(t('labels.eG145'))}
                keyboardType="decimal-pad"
                editable={!isWeightLocked}
                // The pair is all-or-nothing: the submit path drops a weight
                // with no resolved unit id, so a refusal has to say which half
                // is missing rather than the value silently vanishing.
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="netWeightUnit"
            render={({ field: { onChange, value }, fieldState }) => (
              <UnitAutocompleteField
                variant="modal"
                label={t('storageLocationForm.unit')}
                value={value || ''}
                onChangeText={onChange}
                onUnitSelected={onNetWeightUnitSelected}
                placeholder={t('labels.ozGMl')}
                error={fieldState.error?.message}
              />
            )}
          />
        </FieldRow>
      </View>
      {!!isWeightLocked && (
        <Text style={styles.lockedHint}>{t('itemForm.netWeightLocked')}</Text>
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
