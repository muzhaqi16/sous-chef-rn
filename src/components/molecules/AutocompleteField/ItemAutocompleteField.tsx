import { useTranslation } from 'react-i18next';
import React from 'react';
import { ItemSuggestion } from '#/graphql/generated/schemaTypes';
import { useItemAutocomplete } from '#hooks/autocomplete/useItemAutocomplete';
import { resolveImageUrl } from '#utils/imageUtils';
import { GenericAutocompleteField } from './GenericAutocompleteField';
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
  const { t } = useTranslation();
  const item = useItemAutocomplete();

  return (
    <GenericAutocompleteField<ItemSuggestion>
      variant={variant}
      label={label}
      value={value}
      placeholder={placeholder}
      required={required}
      error={error}
      testID={testID}
      onChangeText={text => {
        onChangeText(text);
        item.handleSearchTermChange(text);
      }}
      items={item.displayItems}
      loading={item.isLoading}
      renderItem={i => (
        <AutocompleteRow
          image={resolveImageUrl(i) ?? null}
          title={i.name}
          subtitle={
            showBrand && i.brands?.length === 1 ? i.brands[0].name : undefined
          }
        />
      )}
      keyExtractor={i => i.id}
      onSelect={selected => {
        onChangeText(selected.name.trim());
        onSelectItem?.(selected);
        item.setSearchTerm('');
      }}
      inlineMinSearchLength={2}
      maxResults={5}
      modalTitle={t('autocomplete.selectItem')}
      modalSearchPlaceholder={t('autocomplete.itemSearch')}
      modalEmptyText={t('autocomplete.noItems')}
      modalEmptySubtext={
        item.shouldSearch
          ? `Continue typing to add "${item.searchTerm}"`
          : 'Type at least 2 characters to search'
      }
      modalMinSearchLength={2}
      onSearchChange={item.handleSearchTermChange}
    />
  );
};
