import { useTranslation } from '#/i18n';
import React from 'react';
import type { CategorySuggestion } from '#/graphql/generated/schemaTypes';
import { CategoryType } from '#/graphql/generated/schemaTypes';
import { useCategoryAutocomplete } from '#features/catalog/hooks/useCategoryAutocomplete';
import { GenericAutocompleteField } from '#features/catalog/components/AutocompleteField/GenericAutocompleteField';
import type { FieldChaining } from '#features/catalog/components/InlineAutocomplete';
import { AutocompleteRow } from '#features/catalog/components/AutocompleteField/AutocompleteRow';

interface CategoryAutocompleteFieldProps {
  variant: 'inline' | 'modal';
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  testID?: string;
  /** Inline only: where the return key moves on to. */
  chaining?: FieldChaining;
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
  chaining,
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
      chaining={chaining}
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
      modalEmptySubtext={t('autocomplete.typeMoreToAddCategory', {
        term: category.searchTerm,
      })}
      onSearchChange={category.handleSearchTermChange}
    />
  );
};
