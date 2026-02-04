import React from 'react';
import {View, Text} from 'react-native';
import {Control, FieldErrors} from 'react-hook-form';
import {StyleSheet} from 'react-native-unistyles';
import {
  DynamicFormFields,
  FieldDef,
} from '#components/molecules/DynamicFormFields';
import {FormTextArea} from '#components/molecules/FormTextArea';
import { SegmentedControl } from '#components/molecules/SegmentedControl';
import { DatePickerField } from '#components/molecules/DatePickerField';
import {StorageState} from '#generated';

const STORAGE_STATES = Object.values(StorageState);

interface StorageLocation {
  id: string;
  name: string;
  type: string;
  icon?: string | null;
  color?: string | null;
  temperature?: string | null;
  isDefault: boolean;
  parentLocation?: {
    id: string;
    name: string;
  } | null;
}

interface StorageDetailsSectionProps {
  control: Control<any>;
  errors: FieldErrors<any>;
  mode: 'add' | 'edit';
  storageState: StorageState;
  expirationDate?: Date;
  onStorageStateChange: (state: StorageState) => void;
  onDateChange: (date: Date | null) => void;
  onCategorySelected?: (categoryId: string | null) => void;
  storageLocations?: StorageLocation[];
  onStorageLocationSelected?: (locationId: string | null, location: StorageLocation | null) => void;
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
  onCategorySelected,
  storageLocations = [],
  onStorageLocationSelected,
  onAddNewLocation,
}) => {
  // Fields that use DynamicFormFields (react-hook-form integrated)
  const getFields = (): FieldDef<any>[] => [
    {
      name: 'location',
      label: 'Location',
      placeholder: 'e.g., Top shelf, Drawer 2',
      component: 'storageLocationAutocomplete',
      storageLocations,
      onStorageLocationSelected,
      onAddNewLocation,
    },
    {
      name: 'category',
      label: 'Category',
      placeholder: 'e.g., Grains, Dairy',
      component: 'categoryAutocomplete',
      onCategorySelected,
    },
    {
      name: 'notes',
      label: mode === 'edit' ? 'Storage Notes' : 'Notes',
      placeholder: 'Any additional notes...',
      component: FormTextArea,
      props: {numberOfLines: 3},
    },
  ];

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Storage Details</Text>

      {/* Storage State - using reusable SegmentedControl molecule */}
      <SegmentedControl
        label="Storage Type"
        options={STORAGE_STATES}
        value={storageState}
        onChange={onStorageStateChange}
      />

      {/* Expiration Date - using reusable DatePickerField molecule */}
      <DatePickerField
        label="Expiration Date"
        value={expirationDate ?? null}
        onChange={onDateChange}
        placeholder="Select date"
      />

      {/* Remaining fields using DynamicFormFields */}
      <DynamicFormFields
        fields={getFields()}
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
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
}));
