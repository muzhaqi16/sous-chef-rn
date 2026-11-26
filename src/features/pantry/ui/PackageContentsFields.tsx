import React from 'react';
import { useTranslation } from '#i18n';
import type { UnitType } from '#graphql/generated/schemaTypes';
import { FieldRow } from '#components/atoms/FieldRow';
import { FormInput } from '#components/atoms/FormInput';
import type { FocusableInputRef } from '#components/atoms/inputRef';
import { UnitAutocompleteField } from '#features/catalog/ui/autocomplete/UnitAutocompleteField';
import { localizeNumericHint } from '#utils/formatters/number';

interface PackageContentsFieldsProps {
  size: string;
  onSizeChange: (text: string) => void;
  sizeError?: string;
  unit: string;
  onUnitChange: (text: string) => void;
  onUnitSelected: (
    unitId: string | null,
    unitName: string | null,
    unitType?: UnitType | null,
    unitSymbol?: string | null,
  ) => void;
  unitError?: string;
  /** `inline` in a sheet that stacks its pickers, `modal` elsewhere. */
  variant: 'inline' | 'modal';
  sizeTestID?: string;
  unitTestID?: string;
  /** The size input, for a form that focuses its first error. */
  sizeRef?: React.Ref<FocusableInputRef>;
  /** The unit input; `inline` only, as a `modal` unit is a button. */
  unitRef?: React.Ref<FocusableInputRef>;
}

/**
 * The second half of an amount, "each holds 5 lb" or "each holds 10 can": a
 * measure is the package's size, a count what it is used by (`contentsOf`).
 */
export const PackageContentsFields: React.FC<PackageContentsFieldsProps> = ({
  size,
  onSizeChange,
  sizeError,
  unit,
  onUnitChange,
  onUnitSelected,
  unitError,
  variant,
  sizeTestID,
  unitTestID,
  sizeRef,
  unitRef,
}) => {
  const { t } = useTranslation();
  return (
    <FieldRow>
      <FormInput
        ref={sizeRef}
        label={t('packageSize.eachHolds')}
        value={size}
        onChangeText={onSizeChange}
        error={sizeError}
        placeholder={localizeNumericHint(t('labels.eG145'))}
        keyboardType="decimal-pad"
        testID={sizeTestID}
      />
      <UnitAutocompleteField
        variant={variant}
        label={t('labels.unit')}
        value={unit}
        onChangeText={onUnitChange}
        onUnitSelected={onUnitSelected}
        error={unitError}
        placeholder={t('packageSize.unitPlaceholder')}
        testID={unitTestID}
        chaining={unitRef ? { inputRef: unitRef } : undefined}
      />
    </FieldRow>
  );
};
