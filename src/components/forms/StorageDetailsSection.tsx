import React from 'react';
import { View } from 'react-native';
import { Control, FieldErrors } from 'react-hook-form';
import { StyleSheet } from 'react-native-unistyles';
import {
  DynamicFormFields,
  FieldDef,
} from '#components/molecules/DynamicFormFields';
import { FormTextArea } from '#components/molecules/FormTextArea';
import {
  ChipScrollRow,
  type ChipOption,
} from '#components/atoms/ChipScrollRow';
import { DatePickerField } from '#components/molecules/DatePickerField';
import { StorageState, StorageLocation } from '#/graphql/generated/schemaTypes';
import { Text } from '#components/atoms/Text';
import { Label } from '#components/atoms/Label';
import type { PantryItemFormData } from './PantryItemForm';

const STORAGE_STATE_OPTIONS: ChipOption<StorageState>[] = Object.values(
  StorageState,
).map(state => ({ key: state, label: state }));

interface StorageDetailsSectionProps {
  control: Control<PantryItemFormData>;
  errors: FieldErrors<PantryItemFormData>;
  mode: 'add' | 'edit';
  storageState: StorageState;
  expirationDate?: Date;
  onStorageStateChange: (state: StorageState) => void;
  onDateChange: (date: Date | null) => void;
  storageLocations?: StorageLocation[];
  onStorageLocationSelected?: (
    locationId: string | null,
    location: StorageLocation | null,
  ) => void;
  onAddNewLocation?: (name: string) => void;
}

export const StorageDetailsSection: React.FC<StorageDetailsSectionProps> = ({
  control,
  errors,
  mode,
  storageState,
  expirationDate,
  onStorageStateChange,
  onDateChange,
  storageLocations = [],
  onStorageLocationSelected,
  onAddNewLocation,
}) => {
  const locationFields: FieldDef<PantryItemFormData>[] = [
    {
      name: 'location',
      label: 'Location',
      placeholder: 'e.g., Top shelf, Drawer 2',
      component: 'storageLocationAutocomplete',
      storageLocations,
      onStorageLocationSelected,
      onAddNewLocation,
    },
  ];

  const notesFields: FieldDef<PantryItemFormData>[] = [
    {
      name: 'notes',
      label: mode === 'edit' ? 'Storage Notes' : 'Notes',
      placeholder: 'Any additional notes...',
      component: FormTextArea,
      props: { numberOfLines: 3 },
    },
  ];

  return (
    <View style={styles.section}>
      <Text size="lg" weight="semibold" style={styles.sectionTitle}>
        Storage Details
      </Text>

      {/* Storage State - horizontally scrollable pills, matching the
          Storage Locations Type/Temperature selectors. Long options like
          REFRIGERATED scroll off the edge instead of wrapping. */}
      <View style={styles.field}>
        <Label>Storage State</Label>
        <ChipScrollRow
          chipStyle={styles.statePill}
          options={STORAGE_STATE_OPTIONS}
          selected={storageState}
          onSelect={onStorageStateChange}
          edgeFadeColor="background"
        />
      </View>

      {/* Location */}
      <DynamicFormFields
        fields={locationFields}
        control={control}
        errors={errors}
      />

      {/* Expiration Date - using reusable DatePickerField molecule */}
      <DatePickerField
        label="Expiration Date"
        value={expirationDate ?? null}
        onChange={onDateChange}
        placeholder="Select date"
      />

      {/* Notes */}
      <DynamicFormFields
        fields={notesFields}
        control={control}
        errors={errors}
      />
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
  field: {
    marginBottom: theme.spacing.lg,
  },
  // Content-sized pill (not a fixed-height box) with the same md corner radius
  // as the sibling input fields; tighter vertical padding so it doesn't read
  // taller than them.
  statePill: {
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.md,
  },
}));
