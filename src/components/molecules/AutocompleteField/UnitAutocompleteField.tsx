import React, { useCallback } from 'react';
import { useUnitAutocomplete, type UnitItem } from '#hooks/autocomplete/useUnitAutocomplete';
import { AutocompleteField } from './AutocompleteField';
import { AutocompleteRow } from './AutocompleteRow';

interface UnitAutocompleteFieldProps {
  variant: 'inline' | 'modal';
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  testID?: string;
  onUnitSelected?: (unitId: string | null, unitName: string | null, unitType?: string | null) => void;
}

export const UnitAutocompleteField: React.FC<UnitAutocompleteFieldProps> = ({
  variant,
  label,
  value,
  onChangeText,
  placeholder,
  required,
  error,
  testID,
  onUnitSelected,
}) => {
  const unit = useUnitAutocomplete();

  const handleTextChange = useCallback(
    (text: string) => {
      onChangeText(text);
      unit.handleSearchTermChange(text);
      // Clear unit selection when user types manually
      if (!text) {
        onUnitSelected?.(null, null, null);
      }
    },
    [onChangeText, unit, onUnitSelected],
  );

  const handleSelect = useCallback(
    (item: UnitItem) => {
      onChangeText(item.symbol);
      onUnitSelected?.(item.id, item.name, item.type);
      unit.setSearchTerm('');
    },
    [onChangeText, onUnitSelected, unit],
  );

  const renderItem = useCallback(
    (item: UnitItem) => (
      <AutocompleteRow
        symbolText={item.symbol}
        title={item.name}
        trailingText={item.abbreviation ? `(${item.abbreviation})` : undefined}
      />
    ),
    [],
  );

  const keyExtractor = useCallback((item: UnitItem) => item.id, []);

  if (variant === 'inline') {
    return (
      <AutocompleteField<UnitItem>
        variant="inline"
        label={label}
        value={value}
        onChangeText={handleTextChange}
        placeholder={placeholder}
        required={required}
        error={error}
        testID={testID}
        items={unit.displayItems}
        loading={unit.isLoading}
        minSearchLength={1}
        maxResults={6}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        onSelect={handleSelect}
        autoCapitalize="none"
      />
    );
  }

  return (
    <AutocompleteField<UnitItem>
      variant="modal"
      label={label}
      value={value}
      onChangeText={handleTextChange}
      placeholder={placeholder}
      required={required}
      error={error}
      testID={testID}
      title="Select a unit"
      searchPlaceholder="Type to search units..."
      items={unit.displayItems}
      loading={unit.isLoading}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      onSelect={handleSelect}
      emptyText="No units found"
      emptySubtext="Try a different search term"
      onSearchChange={unit.handleSearchTermChange}
      minSearchLength={1}
      autoCapitalize="none"
    />
  );
};
