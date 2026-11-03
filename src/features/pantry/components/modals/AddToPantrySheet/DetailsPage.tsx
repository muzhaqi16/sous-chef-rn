import { pantryTestIDs } from '#features/pantry/testIDs';
import React from 'react';
import { useTranslation } from '#/i18n';
import { StyleSheet } from 'react-native-unistyles';
import { detailsPageBaseStyles } from './detailsPageStyles';
import { BottomSheetFormScrollView } from '#components/atoms/BottomSheetFormScrollView';
import { EditableCounter } from '#components/molecules/EditableCounter';
import { UnitAutocompleteField } from '#features/catalog/ui/autocomplete/UnitAutocompleteField';
import { FieldRow } from '#components/atoms/FieldRow';
import { DropdownStack } from '#components/atoms/DropdownStack';
import { PackageContentsFields } from '#features/pantry/ui/PackageContentsFields';
import type { UnitType } from '#/graphql/generated/schemaTypes';

export interface DetailsPageProps {
  quantityInput: string;
  setQuantityInput: (value: string) => void;
  /** Validation message for the quantity field. */
  quantityError?: string;
  unit: string;
  setUnit: (value: string) => void;
  handleUnitSelected: (
    id: string | null,
    name: string | null,
    type?: UnitType | null,
  ) => void;
  /** A measure holds nothing, so "each holds" is not offered for it. */
  holdsContents: boolean;
  sizeInput: string;
  setSizeInput: (value: string) => void;
  sizeError?: string;
  sizeUnit: string;
  setSizeUnit: (value: string) => void;
  handleSizeUnitSelected: (
    id: string | null,
    name: string | null,
    type?: UnitType | null,
  ) => void;
  sizeUnitError?: string;
  insets: { bottom: number };
}

export const DetailsPage: React.FC<DetailsPageProps> = ({
  quantityInput,
  setQuantityInput,
  quantityError,
  unit,
  setUnit,
  handleUnitSelected,
  holdsContents,
  sizeInput,
  setSizeInput,
  sizeError,
  sizeUnit,
  setSizeUnit,
  handleSizeUnitSelected,
  sizeUnitError,
  insets,
}) => {
  const { t } = useTranslation();
  return (
    <BottomSheetFormScrollView
      key="details"
      style={styles.page}
      contentContainerStyle={[
        styles.pageContent,
        { paddingBottom: insets.bottom + 20 },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <DropdownStack>
        <FieldRow>
          <EditableCounter
            label={t('labels.quantity')}
            required
            error={quantityError}
            value={quantityInput}
            onChangeText={setQuantityInput}
            placeholder={t('addToPantry.quantityPlaceholder')}
            testID={pantryTestIDs.addDetailsQuantityInput}
          />
          <UnitAutocompleteField
            variant="inline"
            label={t('labels.unit')}
            value={unit}
            onChangeText={setUnit}
            onUnitSelected={handleUnitSelected}
            placeholder={t('labels.pcsDozen')}
            testID={pantryTestIDs.addDetailsUnitPicker}
          />
        </FieldRow>
        {holdsContents ? (
          <PackageContentsFields
            variant="inline"
            useBottomSheetInput
            size={sizeInput}
            onSizeChange={setSizeInput}
            sizeError={sizeError}
            unit={sizeUnit}
            onUnitChange={setSizeUnit}
            onUnitSelected={handleSizeUnitSelected}
            unitError={sizeUnitError}
            sizeTestID={pantryTestIDs.addDetailsSizeInput}
            unitTestID={pantryTestIDs.addDetailsSizeUnitPicker}
          />
        ) : null}
      </DropdownStack>
    </BottomSheetFormScrollView>
  );
};

const styles = StyleSheet.create(theme => ({
  // The hint below carries the rest of the gap.
  netWeightRow: {
    marginBottom: theme.spacing.xs,
  },
  ...detailsPageBaseStyles(theme),
  sectionDescription: {
    marginBottom: theme.spacing.md,
  },
  toggleButton: {
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
  },
  packageDetailsContainer: {
    marginTop: theme.spacing.sm,
  },
  netWeightHint: {
    fontStyle: 'italic',
    marginBottom: theme.spacing.sm,
  },
}));
