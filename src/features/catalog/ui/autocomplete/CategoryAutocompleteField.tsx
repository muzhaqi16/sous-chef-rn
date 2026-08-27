import { useTranslation } from '#/i18n';
import React from 'react';
import {
  CategorySuggestion,
  CategoryType,
} from '#/graphql/generated/schemaTypes';
import { useCategoryAutocomplete } from '#features/catalog/hooks/useCategoryAutocomplete';
import { GenericAutocompleteField } from '#components/molecules/AutocompleteField/GenericAutocompleteField';
import { AutocompleteRow } from '#components/molecules/AutocompleteField/AutocompleteRow';

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

export const CategoryAutocompleteField: React.FC<
  CategoryAutocompleteFieldProps
> = ({
  variant,
  label,
  value,
  onChangeText,
  placeholder,
  required,
  error,
  testID,
  onCategorySelected,
  categoryType = CategoryType.General,
}) => {
  const { t } = useTranslation();
  const category = useCategoryAutocomplete({ categoryType });

  return (
    <GenericAutocompleteField<CategorySuggestion>
      variant={variant}
      label={label}
      value={value}
      placeholder={placeholder}
      required={required}
      error={error}
      testID={testID}
      onChangeText={text => {
        onChangeText(text);
        category.handleSearchTermChange(text);
        onCategorySelected?.(null);
      }}
      items={category.displayItems}
      loading={category.isLoading}
      renderItem={item => (
        <AutocompleteRow icon={item.icon ?? undefined} title={item.name} />
      )}
      keyExtractor={item => item.id}
      onSelect={item => {
        onChangeText(item.name);
        onCategorySelected?.(item.id);
        category.setSearchTerm('');
      }}
      inlineMinSearchLength={2}
      maxResults={5}
      modalTitle={t('autocomplete.selectCategory')}
      modalSearchPlaceholder={t('autocomplete.categorySearch')}
      modalEmptyText={t('autocomplete.noCategories')}
      modalEmptySubtext={`Continue typing to use "${category.searchTerm}" as a custom category`}
      onSearchChange={category.handleSearchTermChange}
    />
  );
};
