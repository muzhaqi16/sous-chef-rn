import React, { useState, useCallback, useRef } from 'react';
import {
  useStorageLocationAutocomplete,
  type StorageLocation,
} from '#hooks/autocomplete/useStorageLocationAutocomplete';
import { AutocompleteField } from './AutocompleteField';
import { AutocompleteRow } from './AutocompleteRow';

interface StorageLocationAutocompleteFieldProps {
  variant: 'inline' | 'modal';
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  testID?: string;
  storageLocations: StorageLocation[];
  onStorageLocationSelected?: (locationId: string | null, location: StorageLocation | null) => void;
  onAddNewLocation?: (name: string) => void;
}

export const StorageLocationAutocompleteField: React.FC<StorageLocationAutocompleteFieldProps> = ({
  variant,
  label,
  value,
  onChangeText,
  placeholder = 'Select storage location',
  required,
  error,
  testID,
  storageLocations = [],
  onStorageLocationSelected,
  onAddNewLocation,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const hasSelectionRef = useRef(false);

  const { displayItems, showAddNew } = useStorageLocationAutocomplete({
    storageLocations,
    searchTerm,
  });

  const handleTextChange = useCallback(
    (text: string) => {
      onChangeText(text);
      setSearchTerm(text);
      if (hasSelectionRef.current) {
        hasSelectionRef.current = false;
        onStorageLocationSelected?.(null, null);
      }
    },
    [onChangeText, onStorageLocationSelected],
  );

  const handleSelect = useCallback(
    (item: StorageLocation) => {
      hasSelectionRef.current = true;
      const displayName = item.parentLocation
        ? `${item.name} (${item.parentLocation.name})`
        : item.name;
      onChangeText(displayName);
      setSearchTerm('');
      onStorageLocationSelected?.(item.id, item);
    },
    [onChangeText, onStorageLocationSelected],
  );

  const handleAddNew = useCallback(() => {
    hasSelectionRef.current = false;
    onChangeText(searchTerm);
    setSearchTerm('');
    onStorageLocationSelected?.(null, null);
    onAddNewLocation?.(searchTerm);
  }, [searchTerm, onChangeText, onStorageLocationSelected, onAddNewLocation]);

  const renderItem = useCallback(
    (item: StorageLocation) => (
      <AutocompleteRow
        icon={item.icon ?? undefined}
        title={item.name}
        subtitle={item.parentLocation ? `Inside ${item.parentLocation.name}` : undefined}
        badge={item.isDefault ? 'Default' : undefined}
      />
    ),
    [],
  );

  const keyExtractor = useCallback((item: StorageLocation) => item.id, []);

  if (variant === 'inline') {
    return (
      <AutocompleteField<StorageLocation>
        variant="inline"
        label={label}
        value={value}
        onChangeText={handleTextChange}
        placeholder={placeholder}
        required={required}
        error={error}
        testID={testID}
        items={displayItems}
        loading={false}
        minSearchLength={1}
        maxResults={6}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        onSelect={handleSelect}
        showAddNew={showAddNew}
        addNewLabel={`Add "${searchTerm}"`}
        addNewSubtext="Create new location"
        onAddNew={handleAddNew}
      />
    );
  }

  return (
    <AutocompleteField<StorageLocation>
      variant="modal"
      label={label}
      value={value}
      onChangeText={handleTextChange}
      placeholder={placeholder}
      required={required}
      error={error}
      title="Select a storage location"
      searchPlaceholder="Type to search storage locations..."
      items={displayItems}
      loading={false}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      onSelect={handleSelect}
      emptyText={storageLocations.length === 0 ? 'No storage locations yet' : 'No matching locations'}
      emptySubtext={
        searchTerm.length >= 2
          ? `Tap "Add" below to create "${searchTerm}"`
          : 'Type at least 2 characters to search or add new'
      }
      onSearchChange={setSearchTerm}
      showAddNew={showAddNew}
      addNewLabel={`Add "${searchTerm}"`}
      addNewSubtext="Create new location"
      onAddNew={handleAddNew}
    />
  );
};
