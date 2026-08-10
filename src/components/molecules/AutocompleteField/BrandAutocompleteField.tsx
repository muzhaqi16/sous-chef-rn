import { useTranslation } from 'react-i18next';
import React from 'react';
import {
  useBrandAutocomplete,
  type BrandItem,
} from '#hooks/autocomplete/useBrandAutocomplete';
import { GenericAutocompleteField } from './GenericAutocompleteField';
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
  const { t } = useTranslation();
  const brand = useBrandAutocomplete({ suggestedBrands });

  return (
    <GenericAutocompleteField<BrandItem>
      variant={variant}
      label={label}
      value={value}
      placeholder={placeholder}
      required={required}
      error={error}
      testID={testID}
      onChangeText={text => {
        onChangeText(text);
        brand.handleSearchTermChange(text);
        onBrandSelected?.(null, null);
      }}
      items={brand.displayItems}
      loading={brand.isLoading}
      renderItem={item => (
        <AutocompleteRow
          title={item.name}
          badge={item.isSuggested ? 'Suggested' : undefined}
          highlighted={item.isSuggested}
        />
      )}
      keyExtractor={item => item.id}
      onSelect={item => {
        onChangeText(item.name);
        onBrandSelected?.(item.id, item.name);
        brand.setSearchTerm('');
      }}
      autoCapitalize="words"
      inlineMinSearchLength={1}
      maxResults={6}
      modalTitle={t('autocomplete.selectBrand')}
      modalSearchPlaceholder={t('autocomplete.brandSearch')}
      modalEmptyText={
        suggestedBrands.length > 0
          ? t('autocomplete.noMatchingBrands')
          : t('autocomplete.noBrands')
      }
      modalEmptySubtext={
        brand.shouldSearch
          ? `Continue typing to add "${brand.searchTerm}" as a custom brand`
          : 'Type at least 2 characters to search'
      }
      modalMinSearchLength={suggestedBrands.length > 0 ? 0 : 2}
      onSearchChange={brand.handleSearchTermChange}
    />
  );
};
