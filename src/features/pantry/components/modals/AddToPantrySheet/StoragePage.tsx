import React from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { StyleSheet } from 'react-native-unistyles';
import { detailsPageBaseStyles } from './detailsPageStyles';
import { BottomSheetFormScrollView } from '#components/atoms/BottomSheetFormScrollView';
import { DropdownStack } from '#components/atoms/DropdownStack';
import { FormInput } from '#components/atoms/FormInput';
import { StorageLocationAutocompleteField } from '#features/catalog/ui/autocomplete/StorageLocationAutocompleteField';
import { SegmentedControl } from '#components/molecules/SegmentedControl';
import {
  ItemCondition,
  type StorageLocation,
} from '#/graphql/generated/schemaTypes';
import {
  ITEM_CONDITION_OPTIONS,
  conditionLabelKey,
} from '#features/pantry/utils/itemEnumLabels';

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
  const formatConditionLabel = (value: ItemCondition) =>
    t(conditionLabelKey(value));
  return (
    <BottomSheetFormScrollView
      key="storage"
      style={styles.page}
      contentContainerStyle={[
        styles.pageContent,
        { paddingBottom: insets.bottom + 20 },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <DropdownStack>
        {/* Storage Location */}
        <View style={styles.section}>
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
          label={t('labels.condition')}
          options={ITEM_CONDITION_OPTIONS}
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
      </DropdownStack>
    </BottomSheetFormScrollView>
  );
};

const styles = StyleSheet.create(theme => {
  const base = detailsPageBaseStyles(theme);
  return {
    ...base,
    pageContent: {
      ...base.pageContent,
      // An inline dropdown paints outside the scroll content's box.
      overflow: 'visible',
    },
  };
});
