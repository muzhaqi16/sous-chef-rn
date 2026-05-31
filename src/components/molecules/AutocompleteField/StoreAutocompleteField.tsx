import React from 'react';
import {
  useStoreAutocomplete,
  type StoreItem,
} from '#hooks/autocomplete/useStoreAutocomplete';
import { GenericAutocompleteField } from './GenericAutocompleteField';
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

  return (
    <GenericAutocompleteField<StoreItem>
      variant={variant}
      label={label}
      value={value}
      placeholder={placeholder}
      required={required}
      error={error}
      testID={testID}
      onChangeText={text => {
        onChangeText(text);
        store.handleSearchTermChange(text);
        onStoreSelected?.(null, null);
      }}
      items={store.displayItems}
      loading={store.isLoading}
      renderItem={item => (
        <AutocompleteRow
          title={item.name}
          subtitle={item.address || undefined}
        />
      )}
      keyExtractor={item => item.id}
      onSelect={item => {
        onChangeText(item.name);
        onStoreSelected?.(item.id, item.name);
        store.setSearchTerm('');
      }}
      autoCapitalize="words"
      inlineMinSearchLength={2}
      maxResults={6}
      modalTitle="Select a store"
      modalSearchPlaceholder="Type to search stores..."
      modalEmptyText="No stores found"
      modalEmptySubtext={
        store.shouldSearch
          ? `Continue typing to add "${store.searchTerm}" as a custom store`
          : 'Type at least 2 characters to search'
      }
      modalMinSearchLength={2}
      onSearchChange={store.handleSearchTermChange}
    />
  );
};
