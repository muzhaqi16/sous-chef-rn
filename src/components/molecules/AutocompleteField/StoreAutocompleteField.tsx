import React from 'react';
import {
  useStoreAutocomplete,
  type StoreItem,
} from '#hooks/autocomplete/useStoreAutocomplete';
import { AutocompleteField } from './AutocompleteField';
import { AutocompleteRow } from './AutocompleteRow';

interface StoreAutocompleteFieldProps {
  variant: 'inline' | 'modal';
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  testID?: string;
  onStoreSelected?: (storeId: string | null, storeName: string | null) => void;
}

export const StoreAutocompleteField: React.FC<StoreAutocompleteFieldProps> = ({
  variant,
  label,
  value,
  onChangeText,
  placeholder,
  required,
  error,
  testID,
  onStoreSelected,
}) => {
  const store = useStoreAutocomplete();

  const handleTextChange = (text: string) => {
    onChangeText(text);
    store.handleSearchTermChange(text);
    onStoreSelected?.(null, null);
  };

  const handleSelect = (item: StoreItem) => {
    onChangeText(item.name);
    onStoreSelected?.(item.id, item.name);
    store.setSearchTerm('');
  };

  const renderItem = (item: StoreItem) => (
    <AutocompleteRow title={item.name} subtitle={item.address || undefined} />
  );

  const keyExtractor = (item: StoreItem) => item.id;

  if (variant === 'inline') {
    return (
      <AutocompleteField<StoreItem>
        variant="inline"
        label={label}
        value={value}
        onChangeText={handleTextChange}
        placeholder={placeholder}
        required={required}
        error={error}
        testID={testID}
        items={store.displayItems}
        loading={store.isLoading}
        minSearchLength={2}
        maxResults={6}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        onSelect={handleSelect}
        autoCapitalize="words"
      />
    );
  }

  return (
    <AutocompleteField<StoreItem>
      variant="modal"
      label={label}
      value={value}
      onChangeText={handleTextChange}
      placeholder={placeholder}
      required={required}
      error={error}
      testID={testID}
      title="Select a store"
      searchPlaceholder="Type to search stores..."
      items={store.displayItems}
      loading={store.isLoading}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      onSelect={handleSelect}
      emptyText="No stores found"
      emptySubtext={
        store.shouldSearch
          ? `Continue typing to add "${store.searchTerm}" as a custom store`
          : 'Type at least 2 characters to search'
      }
      onSearchChange={store.handleSearchTermChange}
      minSearchLength={2}
      autoCapitalize="words"
    />
  );
};
