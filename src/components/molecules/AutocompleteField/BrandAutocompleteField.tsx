import React, { useCallback } from 'react';
import { useBrandAutocomplete, type BrandItem } from '#hooks/autocomplete/useBrandAutocomplete';
import { AutocompleteField } from './AutocompleteField';
import { AutocompleteRow } from './AutocompleteRow';

interface BrandAutocompleteFieldProps {
  variant: 'inline' | 'modal';
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  testID?: string;
  suggestedBrands?: Array<{ id: string; name: string }>;
  onBrandSelected?: (brandId: string | null, brandName: string | null) => void;
}

export const BrandAutocompleteField: React.FC<BrandAutocompleteFieldProps> = ({
  variant,
  label,
  value,
  onChangeText,
  placeholder,
  required,
  error,
  testID,
  suggestedBrands = [],
  onBrandSelected,
}) => {
  const brand = useBrandAutocomplete({ suggestedBrands });

  const handleTextChange = useCallback(
    (text: string) => {
      onChangeText(text);
      brand.handleSearchTermChange(text);
      onBrandSelected?.(null, null);
    },
    [onChangeText, brand, onBrandSelected],
  );

  const handleSelect = useCallback(
    (item: BrandItem) => {
      onChangeText(item.name);
      onBrandSelected?.(item.id, item.name);
      brand.setSearchTerm('');
    },
    [onChangeText, onBrandSelected, brand],
  );

  const renderItem = useCallback(
    (item: BrandItem) => (
      <AutocompleteRow
        title={item.name}
        badge={item.isSuggested ? 'Suggested' : undefined}
        highlighted={item.isSuggested}
      />
    ),
    [],
  );

  const keyExtractor = useCallback((item: BrandItem) => item.id, []);

  if (variant === 'inline') {
    return (
      <AutocompleteField<BrandItem>
        variant="inline"
        label={label}
        value={value}
        onChangeText={handleTextChange}
        placeholder={placeholder}
        required={required}
        error={error}
        testID={testID}
        items={brand.displayItems}
        loading={brand.isLoading}
        minSearchLength={1}
        maxResults={6}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        onSelect={handleSelect}
        autoCapitalize="words"
      />
    );
  }

  return (
    <AutocompleteField<BrandItem>
      variant="modal"
      label={label}
      value={value}
      onChangeText={handleTextChange}
      placeholder={placeholder}
      required={required}
      error={error}
      testID={testID}
      title="Select a brand"
      searchPlaceholder="Type to search brands..."
      items={brand.displayItems}
      loading={brand.isLoading}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      onSelect={handleSelect}
      emptyText={suggestedBrands.length > 0 ? 'No matching brands' : 'No brands found'}
      emptySubtext={
        brand.shouldSearch
          ? `Continue typing to add "${brand.searchTerm}" as a custom brand`
          : 'Type at least 2 characters to search'
      }
      onSearchChange={brand.handleSearchTermChange}
      minSearchLength={suggestedBrands.length > 0 ? 0 : 2}
      autoCapitalize="words"
    />
  );
};
