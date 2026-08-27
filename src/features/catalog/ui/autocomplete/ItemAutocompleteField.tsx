import { useTranslation } from '#/i18n';
import React from 'react';
import { ItemSuggestion } from '#/graphql/generated/schemaTypes';
import { useItemAutocomplete } from '#features/catalog/hooks/useItemAutocomplete';
import { resolveImageUrl } from '#utils/imageUtils';
import { GenericAutocompleteField } from '#components/molecules/AutocompleteField/GenericAutocompleteField';
import { AutocompleteRow } from '#components/molecules/AutocompleteField/AutocompleteRow';

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
          ? t('autocomplete.typeMoreToAdd', { term: item.searchTerm })
          : t('autocomplete.typeAtLeastTwo')
      }
      modalMinSearchLength={2}
      onSearchChange={item.handleSearchTermChange}
    />
  );
};
