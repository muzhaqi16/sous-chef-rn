import React, { useState, useRef } from 'react';
import { useTranslation } from '#/i18n';
import { useStorageLocationAutocomplete } from '#features/catalog/hooks/useStorageLocationAutocomplete';
import { type StorageLocation } from '#/graphql/generated/schemaTypes';
import { StorageLocationIcon } from '#features/catalog/ui/StorageLocationIcon';
import { AutocompleteField } from '#components/molecules/AutocompleteField/AutocompleteField';
import { AutocompleteRow } from '#components/molecules/AutocompleteField/AutocompleteRow';

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
  onStorageLocationSelected?: (
    locationId: string | null,
    location: StorageLocation | null,
  ) => void;
  onAddNewLocation?: (name: string) => void;
}

export const StorageLocationAutocompleteField: React.FC<
  StorageLocationAutocompleteFieldProps
> = ({
  variant,
  label,
  value,
  onChangeText,
  placeholder,
  required,
  error,
  testID,
  storageLocations = [],
  onStorageLocationSelected,
  onAddNewLocation,
}) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const hasSelectionRef = useRef(false);

  const { displayItems, showAddNew } = useStorageLocationAutocomplete({
    storageLocations,
    searchTerm,
  });

  const handleTextChange = (text: string) => {
    onChangeText(text);
    setSearchTerm(text);
    if (hasSelectionRef.current) {
      hasSelectionRef.current = false;
      onStorageLocationSelected?.(null, null);
    }
  };

  /**
   * The field's text is the location's OWN name, never a parent-decorated
   * label.
   *
   * That text is not just display: when the selection is cleared — which any
   * keystroke does, via `handleTextChange` — the submit paths fall back to
   * sending it as `storage.storageLocationName`, and the server resolves that
   * name at the ROOT level only (it never matches a nested location). So a
   * decorated `"Freezer (Kitchen Fridge)"` could not match the location it
   * named; it find-or-created a new root location called exactly that, in the
   * shared home, permanently. The nested location is reachable only by id,
   * which `onStorageLocationSelected` carries.
   *
   * Which parent a location sits under is shown on the row while choosing
   * (see `renderItem`), where it disambiguates without entering form state.
   */
  const handleSelect = (item: StorageLocation) => {
    hasSelectionRef.current = true;
    onChangeText(item.name);
    setSearchTerm('');
    onStorageLocationSelected?.(item.id, item);
  };

  const handleAddNew = () => {
    hasSelectionRef.current = false;
    onChangeText(searchTerm);
    setSearchTerm('');
    onStorageLocationSelected?.(null, null);
    onAddNewLocation?.(searchTerm);
  };

  const renderItem = (item: StorageLocation) => (
    <AutocompleteRow
      iconElement={<StorageLocationIcon type={item.type} size={24} />}
      title={item.name}
      subtitle={
        item.parentLocation
          ? t('storageLocationCard.insideParent', {
              parent: item.parentLocation.name,
            })
          : undefined
      }
      badge={item.isDefault ? t('labels.default') : undefined}
    />
  );

  const keyExtractor = (item: StorageLocation) => item.id;

  if (variant === 'inline') {
    return (
      <AutocompleteField<StorageLocation>
        variant="inline"
        label={label}
        value={value}
        onChangeText={handleTextChange}
        placeholder={
          placeholder ?? t('autocomplete.storageLocationPlaceholder')
        }
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
        addNewLabel={t('labels.addNamed', { name: searchTerm })}
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
      placeholder={placeholder ?? t('autocomplete.storageLocationPlaceholder')}
      required={required}
      error={error}
      title={t('autocomplete.selectStorageLocation')}
      searchPlaceholder={t('autocomplete.storageLocationSearch')}
      items={displayItems}
      loading={false}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      onSelect={handleSelect}
      emptyText={
        storageLocations.length === 0
          ? t('autocomplete.noStorageLocations')
          : t('autocomplete.noMatchingLocations')
      }
      emptySubtext={
        searchTerm.length >= 2
          ? t('autocomplete.tapAddToCreate', { term: searchTerm })
          : t('autocomplete.typeToSearch')
      }
      onSearchChange={setSearchTerm}
      showAddNew={showAddNew}
      addNewLabel={t('labels.addNamed', { name: searchTerm })}
      onAddNew={handleAddNew}
    />
  );
};
