import React from 'react';
import { CategorySuggestion, CategoryType } from '#generated';
import { useCategoryAutocomplete } from '#hooks/autocomplete/useCategoryAutocomplete';
import { AutocompleteField } from './AutocompleteField';
import { AutocompleteRow } from './AutocompleteRow';

interface CategoryAutocompleteFieldProps {
  variant: 'inline' | 'modal';
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  testID?: string;
  onCategorySelected?: (categoryId: string | null) => void;
  categoryType?: CategoryType;
}

export const CategoryAutocompleteField: React.FC<CategoryAutocompleteFieldProps> = ({
  variant,
  label,
  value,
  onChangeText,
  placeholder,
  required,
  error,
  testID,
  onCategorySelected,
  categoryType = CategoryType.General }) => {
  const category = useCategoryAutocomplete({ categoryType });

  const handleTextChange = (text: string) => {
      onChangeText(text);
      category.handleSearchTermChange(text);
      onCategorySelected?.(null);
    };

  const handleSelect = (item: CategorySuggestion) => {
      onChangeText(item.name);
      onCategorySelected?.(item.id);
      category.setSearchTerm('');
    };

  const renderItem = (item: CategorySuggestion) => (
      <AutocompleteRow
        icon={item.icon ?? undefined}
        title={item.name}
      />
    );

  const keyExtractor = (item: CategorySuggestion) => item.id;

  if (variant === 'inline') {
    return (
      <AutocompleteField<CategorySuggestion>
        variant="inline"
        label={label}
        value={value}
        onChangeText={handleTextChange}
        placeholder={placeholder}
        required={required}
        error={error}
        testID={testID}
        items={category.displayItems}
        loading={category.isLoading}
        minSearchLength={2}
        maxResults={5}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        onSelect={handleSelect}
      />
    );
  }

  return (
    <AutocompleteField<CategorySuggestion>
      variant="modal"
      label={label}
      value={value}
      onChangeText={handleTextChange}
      placeholder={placeholder}
      required={required}
      error={error}
      title="Select a category"
      searchPlaceholder="Type to search categories..."
      items={category.displayItems}
      loading={category.isLoading}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      onSelect={handleSelect}
      emptyText="No categories found"
      emptySubtext={`Continue typing to use "${category.searchTerm}" as a custom category`}
      onSearchChange={category.handleSearchTermChange}
    />
  );
};
