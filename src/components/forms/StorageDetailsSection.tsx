import React from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import {Control, FieldErrors} from 'react-hook-form';
import DateTimePicker from '@react-native-community/datetimepicker';
import {Icon} from '#utils';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {
  DynamicFormFields,
  FieldDef,
} from '#components/molecules/DynamicFormFields';
import {FormInput} from '#components/molecules/FormInput';
import {FormTextArea} from '#components/molecules/FormTextArea';
import {StorageState} from '#generated';
import {commonStyles} from '#/styles/commonStyles';

const STORAGE_STATES = Object.values(StorageState);

interface StorageDetailsSectionProps {
  control: Control<any>;
  errors: FieldErrors<any>;
  mode: 'add' | 'edit';
  storageState: StorageState;
  expirationDate?: Date;
  showDatePicker: boolean;
  onStorageStateChange: (state: StorageState) => void;
  onDatePickerToggle: () => void;
  onDateChange: (date?: Date) => void;
}

export const StorageDetailsSection: React.FC<StorageDetailsSectionProps> = ({
  control,
  errors,
  mode,
  storageState,
  expirationDate,
  showDatePicker,
  onStorageStateChange,
  onDatePickerToggle,
  onDateChange,
}) => {
  const {theme} = useUnistyles();

  const getFields = (): FieldDef<any>[] => [
    {
      name: 'storageState',
      label: 'Storage Type',
      component: () => (
        <View style={styles.segmentedControl}>
          {STORAGE_STATES.map(state => (
            <TouchableOpacity
              key={state}
              style={[
                styles.segment,
                storageState === state && styles.segmentActive,
              ]}
              onPress={() => onStorageStateChange(state)}>
              <Text
                style={[
                  styles.segmentText,
                  storageState === state && styles.segmentTextActive,
                ]}
                numberOfLines={1}>
                {state}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ),
    },
    {
      name: 'location',
      label: 'Location',
      placeholder: 'e.g., Top shelf, Drawer 2',
      component: FormInput,
    },
    {
      name: 'expirationDate',
      label: 'Expiration Date',
      component: ({label}: {label: string}) => (
        <View>
          <Text style={styles.fieldLabel}>{label}</Text>
          <TouchableOpacity
            style={[commonStyles.input, commonStyles.row, styles.dateInput]}
            onPress={onDatePickerToggle}>
            <Icon name="event" size={20} color={theme.colors.textSecondary} />
            <Text style={styles.dateText}>
              {expirationDate
                ? expirationDate.toLocaleDateString()
                : 'Select date'}
            </Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={expirationDate || new Date()}
              mode="date"
              onChange={(event, date) => {
                onDateChange(date);
              }}
            />
          )}
        </View>
      ),
    },
    {
      name: 'category',
      label: 'Category',
      placeholder: 'e.g., Grains, Dairy',
      component: FormInput,
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
  segmentedControl: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    overflow: 'hidden',
    marginBottom: theme.spacing.md,
  },
  segment: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  segmentActive: {
    backgroundColor: theme.colors.primary,
  },
  segmentText: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
  segmentTextActive: {
    color: theme.colors.white,
  },
  dateInput: {
    justifyContent: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  dateText: {
    fontSize: theme.fonts.size.base,
    color: theme.colors.textPrimary,
    marginLeft: theme.spacing.md,
  },
  fieldLabel: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.medium,
    marginBottom: theme.spacing.sm,
  },
}));
