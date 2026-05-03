import React from 'react';
import { ItemSuggestion } from '#/graphql/generated/schemaTypes';
import { useItemAutocomplete } from '#hooks/autocomplete/useItemAutocomplete';
import { resolveImageUrl } from '#utils/imageUtils';
import { AutocompleteField } from './AutocompleteField';
import { AutocompleteRow } from './AutocompleteRow';

interface ItemAutocompleteFieldProps {
  variant: 'inline' | 'modal';
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  testID?: string;
  onSelectItem?: (item: ItemSuggestion) => void;
  showBrand?: boolean;
  autoFocus?: boolean;
}

export const ItemAutocompleteField: React.FC<ItemAutocompleteFieldProps> = ({
  variant,
  label,
  value,
  onChangeText,
  placeholder,
  required,
  error,
  testID,
  onSelectItem,
  showBrand = false,
}) => {
  const item = useItemAutocomplete();

  const handleTextChange = (text: string) => {
    onChangeText(text);
    item.handleSearchTermChange(text);
  };

  const handleSelect = (selected: ItemSuggestion) => {
    onChangeText(selected.name.trim());
    onSelectItem?.(selected);
    item.setSearchTerm('');
  };

  const renderItem = (i: ItemSuggestion) => (
    <AutocompleteRow
      image={resolveImageUrl(i) ?? null}
      title={i.name}
      subtitle={
        showBrand && i.brands?.length === 1 ? i.brands[0].name : undefined
      }
    />
  );

  const keyExtractor = (i: ItemSuggestion) => i.id;

  if (variant === 'inline') {
    return (
      <AutocompleteField<ItemSuggestion>
        variant="inline"
        label={label}
        value={value}
        onChangeText={handleTextChange}
        placeholder={placeholder}
        required={required}
        error={error}
        testID={testID}
        items={item.displayItems}
        loading={item.isLoading}
        minSearchLength={2}
        maxResults={5}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        onSelect={handleSelect}
      />
    );
  }

  return (
    <AutocompleteField<ItemSuggestion>
      variant="modal"
      label={label}
      value={value}
      onChangeText={handleTextChange}
      placeholder={placeholder}
      required={required}
      error={error}
      testID={testID}
      title="Search for an item"
      searchPlaceholder="Type to search items..."
      items={item.displayItems}
      loading={item.isLoading}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      onSelect={handleSelect}
      emptyText="No items found"
      emptySubtext={
        item.shouldSearch
          ? `Continue typing to add "${item.searchTerm}"`
          : 'Type at least 2 characters to search'
      }
      onSearchChange={item.handleSearchTermChange}
      minSearchLength={2}
    />
  );
};
