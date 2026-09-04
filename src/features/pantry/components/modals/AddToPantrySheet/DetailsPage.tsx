import React from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { detailsPageBaseStyles } from './detailsPageStyles';
import { BottomSheetFormScrollView } from '#components/atoms/BottomSheetFormScrollView';
import { FormInput } from '#components/atoms/FormInput';
import { EditableCounter } from '#components/molecules/EditableCounter';
import { UnitAutocompleteField } from '#features/catalog/ui/autocomplete/UnitAutocompleteField';
import { FieldRow } from '#components/atoms/FieldRow';
import { DropdownStack } from '#components/atoms/DropdownStack';
import { Text } from '#components/atoms/Text';
import { localizeNumericHint } from '#/utils/formatters/number';

export interface DetailsPageProps {
  quantityInput: string;
  setQuantityInput: (value: string) => void;
  /** Validation message for the quantity field. */
  quantityError?: string;
  /** Validation message for the net-weight UNIT picker (net weight is all-or-nothing). */
  pantryNetWeightError?: string;
  pantryNetWeightUnitError?: string;
  /** Package-details pair: a per-container weight needs its unit, and vice versa. */
  itemNetWeightError?: string;
  weightUnitError?: string;
  unit: string;
  setUnit: (value: string) => void;
  handleUnitSelected: (id: string | null, name: string | null) => void;
  pantryNetWeight: string;
  setPantryNetWeight: (value: string) => void;
  pantryNetWeightUnit: string;
  setPantryNetWeightUnit: (value: string) => void;
  handlePantryNetWeightUnitSelected: (
    id: string | null,
    name: string | null,
  ) => void;
  showPackageDetails: boolean;
  setShowPackageDetails: (value: boolean) => void;
  packageSize: string;
  setPackageSize: (value: string) => void;
  contentUnit: string;
  setContentUnit: (value: string) => void;
  handleContentUnitSelected: (id: string | null, name: string | null) => void;
  itemNetWeight: string;
  setItemNetWeight: (value: string) => void;
  weightUnit: string;
  setWeightUnit: (value: string) => void;
  handleWeightUnitSelected: (id: string | null, name: string | null) => void;
  insets: { bottom: number };
}

export const DetailsPage: React.FC<DetailsPageProps> = ({
  quantityInput,
  setQuantityInput,
  quantityError,
  pantryNetWeightError,
  pantryNetWeightUnitError,
  itemNetWeightError,
  weightUnitError,
  unit,
  setUnit,
  handleUnitSelected,
  pantryNetWeight,
  setPantryNetWeight,
  pantryNetWeightUnit,
  setPantryNetWeightUnit,
  handlePantryNetWeightUnitSelected,
  showPackageDetails,
  setShowPackageDetails,
  packageSize,
  setPackageSize,
  contentUnit,
  setContentUnit,
  handleContentUnitSelected,
  itemNetWeight,
  setItemNetWeight,
  weightUnit,
  setWeightUnit,
  handleWeightUnitSelected,
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
        {/* Quantity + Unit */}
        <FieldRow>
          <EditableCounter
            label={t('labels.quantity')}
            required
            error={quantityError}
            value={quantityInput}
            onChangeText={setQuantityInput}
            placeholder={t('addToPantry.quantityPlaceholder')}
            testID="add-pantry-item-quantity-input"
          />
          <UnitAutocompleteField
            variant="inline"
            label={t('storageLocationForm.unit')}
            value={unit}
            onChangeText={setUnit}
            onUnitSelected={handleUnitSelected}
            placeholder={t('labels.pcsDozen')}
            testID="add-pantry-item-unit-picker"
          />
        </FieldRow>
        {/* Net Weight */}
        <View>
          <FieldRow containerStyle={styles.netWeightRow}>
            <FormInput
              label={t('labels.netWeight')}
              value={pantryNetWeight}
              onChangeText={setPantryNetWeight}
              // The all-or-nothing rule reports on BOTH halves of the pair; only
              // the unit half was rendered, and FIELD_PAGE navigates here for a
              // message that had nowhere to appear.
              error={pantryNetWeightError}
              placeholder={localizeNumericHint(t('labels.eG145'))}
              keyboardType="decimal-pad"
              useBottomSheetInput
              inputStyle={styles.netWeightInput}
            />
            <UnitAutocompleteField
              variant="inline"
              label={t('storageLocationForm.unit')}
              error={pantryNetWeightUnitError}
              value={pantryNetWeightUnit}
              onChangeText={setPantryNetWeightUnit}
              onUnitSelected={handlePantryNetWeightUnitSelected}
              placeholder={t('labels.ozGMl')}
            />
          </FieldRow>
          <Text role="caption" tone="secondary" style={styles.netWeightHint}>
            {t('labels.netWeightIsUsedForConsumptionTrackingAndIsOptional')}
          </Text>
        </View>
        {/* Package Details - Progressive Disclosure */}
        <View style={styles.section}>
          <AppPressable
            onPress={() => setShowPackageDetails(!showPackageDetails)}
            style={styles.toggleButton}
          >
            <Text role="bodyStrong" tone="accent">
              {showPackageDetails
                ? t('addToPantry.hidePackageDetails')
                : t('addToPantry.addPackageDetails')}
            </Text>
          </AppPressable>

          {!!showPackageDetails && (
            <View style={styles.packageDetailsContainer}>
              <Text
                role="caption"
                tone="secondary"
                style={styles.sectionDescription}
              >
                {t('addToPantry.packageHint')}
              </Text>

              <DropdownStack>
                {/* Package Size */}
                <FormInput
                  label={t('addToPantry.qtyPerPackage')}
                  value={packageSize}
                  onChangeText={setPackageSize}
                  placeholder={t('labels.eG12')}
                  keyboardType="decimal-pad"
                  useBottomSheetInput
                />

                {/* Content Unit */}
                <View style={styles.section}>
                  <UnitAutocompleteField
                    variant="inline"
                    label={t('addToPantry.contentUnit')}
                    value={contentUnit}
                    onChangeText={setContentUnit}
                    onUnitSelected={handleContentUnitSelected}
                    placeholder={t('labels.eGCanBottle')}
                  />
                </View>

                {/* Net Weight + Weight Unit */}
                <View>
                  <FieldRow>
                    <FormInput
                      label={t('addToPantry.weightPerUnit')}
                      value={itemNetWeight}
                      onChangeText={setItemNetWeight}
                      placeholder={t('addToPantry.weightPerUnitPlaceholder')}
                      keyboardType="decimal-pad"
                      error={itemNetWeightError}
                      useBottomSheetInput
                    />
                    <UnitAutocompleteField
                      variant="inline"
                      label={t('labels.weightUnit')}
                      value={weightUnit}
                      onChangeText={setWeightUnit}
                      onUnitSelected={handleWeightUnitSelected}
                      placeholder={t(
                        'addToPantry.contentWeightUnitPlaceholder',
                      )}
                      error={weightUnitError}
                    />
                  </FieldRow>
                </View>
              </DropdownStack>
            </View>
          )}
        </View>
      </DropdownStack>
    </BottomSheetFormScrollView>
  );
};

const styles = StyleSheet.create(theme => ({
  // The hint below carries the rest of the gap.
  netWeightRow: {
    marginBottom: theme.spacing.xs,
  },
  // Matches the unit picker beside it.
  netWeightInput: {
    height: theme.sizes.input.md,
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
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
