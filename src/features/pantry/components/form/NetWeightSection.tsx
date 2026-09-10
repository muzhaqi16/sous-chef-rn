import React from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { Controller, type Control } from 'react-hook-form';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';
import { FormInput } from '#components/atoms/FormInput';
import { UnitAutocompleteField } from '#features/catalog/ui/autocomplete/UnitAutocompleteField';
import { FieldRow } from '#components/atoms/FieldRow';
import type { PantryItemFormData } from './PantryItemForm';
import { localizeNumericHint } from '#/utils/formatters/number';
import { SectionHeader } from '#components/atoms/SectionHeader';

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
      <SectionHeader style={styles.sectionTitleSpacing}>
        {t('labels.netWeight')}
      </SectionHeader>
      <Text role="caption" style={styles.sectionDescription}>
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
        <Text role="caption" style={styles.lockedHint}>
          {t('itemForm.netWeightLocked')}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionDescription: {
    fontStyle: 'italic',
    color: theme.colors.textTertiary,
    marginBottom: theme.spacing.sm,
  },
  lockedSection: {
    opacity: theme.opacity.disabled,
  },
  lockedHint: {
    color: theme.colors.textTertiary,
    fontStyle: 'italic',
  },
  sectionTitleSpacing: {
    marginBottom: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: theme.borderWidth.hairline,
    borderBottomColor: theme.colors.border,
  },
}));
