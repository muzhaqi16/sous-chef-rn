import React from 'react';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { BottomSheetKeyboardAwareScrollView } from '#components/atoms/BottomSheetKeyboardAwareScrollView';
import { FormInput } from '#components/molecules/FormInput';
import { EditableCounter } from '#components/molecules/EditableCounter';
import { UnitAutocompleteField } from '#components/molecules/AutocompleteField/UnitAutocompleteField';
import { FieldRow } from '#components/molecules/FieldRow';
import { Text } from '#components/atoms/Text';

export interface DetailsPageProps {
  quantityInput: string;
  setQuantityInput: (value: string) => void;
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
  return (
    <BottomSheetKeyboardAwareScrollView
      key="details"
      style={styles.page}
      contentContainerStyle={[
        styles.pageContent,
        { paddingBottom: insets.bottom + 20 },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      bottomOffset={16}
    >
      {/* Quantity + Unit */}
      <View style={{ zIndex: 10 }}>
        <FieldRow>
          <EditableCounter
            label="Quantity"
            required
            value={quantityInput}
            onChangeText={setQuantityInput}
            placeholder="1"
            testID="add-pantry-item-quantity-input"
          />
          <UnitAutocompleteField
            variant="inline"
            label="Unit"
            value={unit}
            onChangeText={setUnit}
            onUnitSelected={handleUnitSelected}
            placeholder="pcs, dozen"
            testID="add-pantry-item-unit-picker"
          />
        </FieldRow>
      </View>

      {/* Net Weight */}
      <View style={{ zIndex: 5 }}>
        <FieldRow containerStyle={{ marginBottom: 4 }}>
          <FormInput
            label="Net Weight"
            value={pantryNetWeight}
            onChangeText={setPantryNetWeight}
            placeholder="e.g., 14.5"
            keyboardType="decimal-pad"
            useBottomSheetInput
            inputStyle={{ height: 44 }}
          />
          <UnitAutocompleteField
            variant="inline"
            label="Unit"
            value={pantryNetWeightUnit}
            onChangeText={setPantryNetWeightUnit}
            onUnitSelected={handlePantryNetWeightUnitSelected}
            placeholder="oz, g, ml"
          />
        </FieldRow>
        <Text size="sm" tone="secondary" style={styles.netWeightHint}>
          Net weight is used for consumption tracking and is optional.
        </Text>
      </View>

      {/* Package Details - Progressive Disclosure */}
      <View style={styles.section}>
        <Pressable
          onPress={() => setShowPackageDetails(!showPackageDetails)}
          style={({ pressed }) => [
            styles.toggleButton,
            pressed && styles.pressed,
          ]}
        >
          <Text size="md" weight="medium" tone="accent">
            {showPackageDetails
              ? 'Hide Package Details'
              : 'Add Package Details'}
          </Text>
        </Pressable>

        {!!showPackageDetails && (
          <View style={styles.packageDetailsContainer}>
            <Text size="sm" tone="secondary" style={styles.sectionDescription}>
              Define what's inside a package (e.g., 12 cans of 335ml each).
            </Text>

            {/* Package Size */}
            <FormInput
              label="Qty per Package"
              value={packageSize}
              onChangeText={setPackageSize}
              placeholder="e.g., 12"
              keyboardType="decimal-pad"
              useBottomSheetInput
            />

            {/* Content Unit */}
            <View style={[styles.section, { zIndex: 10 }]}>
              <UnitAutocompleteField
                variant="inline"
                label="Content Unit"
                value={contentUnit}
                onChangeText={setContentUnit}
                onUnitSelected={handleContentUnitSelected}
                placeholder="e.g., can, bottle"
              />
            </View>

            {/* Net Weight + Weight Unit */}
            <View style={{ zIndex: 1 }}>
              <FieldRow>
                <FormInput
                  label="Weight per Unit"
                  value={itemNetWeight}
                  onChangeText={setItemNetWeight}
                  placeholder="e.g., 335"
                  keyboardType="decimal-pad"
                  useBottomSheetInput
                />
                <UnitAutocompleteField
                  variant="inline"
                  label="Weight Unit"
                  value={weightUnit}
                  onChangeText={setWeightUnit}
                  onUnitSelected={handleWeightUnitSelected}
                  placeholder="mL, g, oz"
                />
              </FieldRow>
            </View>
          </View>
        )}
      </View>
    </BottomSheetKeyboardAwareScrollView>
  );
};

const styles = StyleSheet.create(theme => ({
  page: {
    flex: 1,
    minHeight: '100%',
    flexGrow: 1,
  },
  pageContent: {
    padding: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    flexGrow: 1,
  },
  section: {
    marginBottom: theme.spacing.sm,
  },
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
