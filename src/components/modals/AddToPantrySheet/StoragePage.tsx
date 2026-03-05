import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { BottomSheetKeyboardAwareScrollView } from '#components/atoms/BottomSheetKeyboardAwareScrollView';
import { FormInput } from '#components/molecules/FormInput';
import { StorageLocationAutocompleteField } from '#components/molecules/AutocompleteField/StorageLocationAutocompleteField';
import type { StorageLocation } from '#generated';

export interface StoragePageProps {
  storageLocation: string;
  setStorageLocation: (value: string) => void;
  storageLocations: StorageLocation[];
  handleStorageLocationSelected: (
    locationId: string | null,
    location: StorageLocation | null,
  ) => void;
  handleAddNewLocation: (name: string) => void;
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
  tags,
  setTags,
  storageNotes,
  setStorageNotes,
  insets,
}) => {
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
          label="Storage Location"
          value={storageLocation}
          onChangeText={setStorageLocation}
          placeholder="e.g., Top shelf, Crisper drawer"
          storageLocations={storageLocations}
          onStorageLocationSelected={handleStorageLocationSelected}
          onAddNewLocation={handleAddNewLocation}
        />
      </View>

      {/* Tags */}
      <FormInput
        label="Tags"
        value={tags}
        onChangeText={setTags}
        placeholder="e.g., organic, gluten-free (comma separated)"
        useBottomSheetInput
      />

      {/* Notes */}
      <FormInput
        label="Notes"
        value={storageNotes}
        onChangeText={setStorageNotes}
        placeholder="e.g., Store in cool, dry place"
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
