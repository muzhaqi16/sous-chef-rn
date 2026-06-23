import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native-unistyles';
import { BottomSheetKeyboardAwareScrollView } from '#components/atoms/BottomSheetKeyboardAwareScrollView';
import { FormInput } from '#components/molecules/FormInput';
import { StorageLocationAutocompleteField } from '#components/molecules/AutocompleteField/StorageLocationAutocompleteField';
import { SegmentedControl } from '#components/molecules/SegmentedControl';
import {
  ItemCondition,
  type StorageLocation,
} from '#/graphql/generated/schemaTypes';

const CONDITIONS = [
  ItemCondition.Good,
  ItemCondition.Fair,
  ItemCondition.Spoiled,
  ItemCondition.Expired,
];

export interface StoragePageProps {
  storageLocation: string;
  setStorageLocation: (value: string) => void;
  storageLocations: StorageLocation[];
  handleStorageLocationSelected: (
    locationId: string | null,
    location: StorageLocation | null,
  ) => void;
  handleAddNewLocation: (name: string) => void;
  condition: ItemCondition;
  setCondition: (value: ItemCondition) => void;
  tags: string;
  setTags: (value: string) => void;
  storageNotes: string;
  setStorageNotes: (value: string) => void;
  insets: { bottom: number };
}

export const StoragePage: React.FC<StoragePageProps> = ({
  storageLocation,
  setStorageLocation,
  storageLocations,
  handleStorageLocationSelected,
  handleAddNewLocation,
  condition,
  setCondition,
  tags,
  setTags,
  storageNotes,
  setStorageNotes,
  insets,
}) => {
  const { t } = useTranslation();
  const formatConditionLabel = (value: ItemCondition) => {
    switch (value) {
      case ItemCondition.Good:
        return t('addToPantry.conditionGood');
      case ItemCondition.Fair:
        return t('addToPantry.conditionFair');
      case ItemCondition.Spoiled:
        return t('addToPantry.conditionSpoiled');
      case ItemCondition.Expired:
        return t('addToPantry.conditionExpired');
      default:
        return value;
    }
  };
  return (
    <BottomSheetKeyboardAwareScrollView
      key="storage"
      style={styles.page}
      contentContainerStyle={[
        styles.pageContent,
        { overflow: 'visible', paddingBottom: insets.bottom + 20 },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      bottomOffset={16}
    >
      {/* Storage Location */}
      <View style={[styles.section, { zIndex: 10 }]}>
        <StorageLocationAutocompleteField
          variant="inline"
          label={t('addToPantry.storageLocation')}
          value={storageLocation}
          onChangeText={setStorageLocation}
          placeholder={t('addToPantry.storageLocationPlaceholder')}
          storageLocations={storageLocations}
          onStorageLocationSelected={handleStorageLocationSelected}
          onAddNewLocation={handleAddNewLocation}
        />
      </View>

      {/* Condition */}
      <SegmentedControl
        label={t('addToPantry.condition')}
        options={CONDITIONS}
        value={condition}
        onChange={setCondition}
        formatLabel={formatConditionLabel}
      />

      {/* Tags */}
      <FormInput
        label={t('addToPantry.tags')}
        value={tags}
        onChangeText={setTags}
        placeholder={t('addToPantry.tagsPlaceholder')}
        useBottomSheetInput
      />

      {/* Notes */}
      <FormInput
        label={t('addToPantry.notes')}
        value={storageNotes}
        onChangeText={setStorageNotes}
        placeholder={t('addToPantry.notesPlaceholder')}
        multiline
        useBottomSheetInput
      />
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
}));
