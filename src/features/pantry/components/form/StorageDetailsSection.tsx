import React from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
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
import {
  StorageState,
  ItemCondition,
  StorageLocation,
} from '#/graphql/generated/schemaTypes';
import { Text } from '#components/atoms/Text';
import { Label } from '#components/atoms/Label';
import type { PantryItemFormData } from './PantryItemForm';
import {
  ITEM_CONDITION_OPTIONS,
  conditionLabelKey,
} from '#/utils/items/itemEnumLabels';
import type { Translate } from '#/i18n/types';

// A function, not a const: at import time these labels would freeze whichever
// language loaded first. `enumKeyCoverage.test.ts` asserts every StorageState
// member has a key, so a new enum member fails the suite rather than shipping
// a raw SCREAMING_SNAKE value.
const getStorageStateOptions = (t: Translate): ChipOption<StorageState>[] =>
  Object.values(StorageState).map(state => ({
    key: state,
    label: t(`storageState.${state}`),
  }));

interface StorageDetailsSectionProps {
  control: Control<PantryItemFormData>;
  errors: FieldErrors<PantryItemFormData>;
  storageState: StorageState;
  condition: ItemCondition;
  expirationDate?: Date;
  onStorageStateChange: (state: StorageState) => void;
  onConditionChange: (condition: ItemCondition) => void;
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
  storageState,
  condition,
  expirationDate,
  onStorageStateChange,
  onConditionChange,
  onDateChange,
  storageLocations = [],
  onStorageLocationSelected,
  onAddNewLocation,
}) => {
  const { t } = useTranslation();
  const conditionOptions: ChipOption<ItemCondition>[] =
    ITEM_CONDITION_OPTIONS.map(c => ({
      key: c,
      label: t(conditionLabelKey(c)),
    }));
  const locationFields: FieldDef<PantryItemFormData>[] = [
    {
      name: 'location',
      label: t('itemForm.location'),
      placeholder: t('itemForm.locationPlaceholder'),
      component: 'storageLocationAutocomplete',
      props: { storageLocations, onStorageLocationSelected, onAddNewLocation },
    },
  ];

  const notesFields: FieldDef<PantryItemFormData>[] = [
    {
      name: 'notes',
      label: t('itemForm.storageNotes'),
      placeholder: t('labels.anyAdditionalNotes'),
      component: FormTextArea,
      props: { numberOfLines: 3 },
    },
  ];

  return (
    <View style={styles.section}>
      <Text size="lg" weight="semibold" style={styles.sectionTitle}>
        {t('itemForm.storageDetails')}
      </Text>

      {/* Storage State - horizontally scrollable pills, matching the
          Storage Locations Type/Temperature selectors. Long options like
          REFRIGERATED scroll off the edge instead of wrapping. */}
      <View style={styles.field}>
        <Label>{t('labels.storageState')}</Label>
        <ChipScrollRow
          chipStyle={styles.statePill}
          options={getStorageStateOptions(t)}
          selected={storageState}
          onSelect={onStorageStateChange}
          edgeFadeColor="background"
        />
      </View>

      {/* Condition */}
      <View style={styles.field}>
        <Label>{t('labels.condition')}</Label>
        <ChipScrollRow
          chipStyle={styles.statePill}
          options={conditionOptions}
          selected={condition}
          onSelect={onConditionChange}
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
        label={t('labels.expirationDate')}
        value={expirationDate ?? null}
        onChange={onDateChange}
        placeholder={t('labels.selectDate')}
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
    borderBottomWidth: theme.borderWidth.hairline,
    borderBottomColor: theme.colors.border,
  },
  field: {
    marginBottom: theme.spacing.lg,
  },
  // Content-sized pill sharing the sibling inputs' md radius, with tighter
  // vertical padding so it doesn't read taller than them.
  statePill: {
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
  },
}));
