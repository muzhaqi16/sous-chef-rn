import { useTranslation } from '#/i18n';
import React from 'react';
import {
  useUnitAutocomplete,
  type UnitItem,
} from '#hooks/autocomplete/useUnitAutocomplete';
import { GenericAutocompleteField } from './GenericAutocompleteField';
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
  onUnitSelected?: (
    unitId: string | null,
    unitName: string | null,
    unitType?: string | null,
    unitSymbol?: string | null,
  ) => void;
  /** See `InlineAutocomplete`: for hosts sized to their own content. */
  reserveDropdownSpace?: boolean;
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
  reserveDropdownSpace,
}) => {
  const { t } = useTranslation();
  const unit = useUnitAutocomplete();

  return (
    <GenericAutocompleteField<UnitItem>
      variant={variant}
      reserveDropdownSpace={reserveDropdownSpace}
      label={label}
      value={value}
      placeholder={placeholder}
      required={required}
      error={error}
      testID={testID}
      onChangeText={text => {
        onChangeText(text);
        unit.handleSearchTermChange(text);
        // Any manual typing invalidates the previous autocomplete selection
        onUnitSelected?.(null, null, null);
      }}
      items={unit.displayItems}
      loading={unit.isLoading}
      renderItem={item => (
        <AutocompleteRow
          symbolText={item.symbol}
          title={item.name}
          trailingText={
            item.abbreviation ? `(${item.abbreviation})` : undefined
          }
        />
      )}
      keyExtractor={item => item.id}
      onSelect={item => {
        onChangeText(item.symbol);
        onUnitSelected?.(item.id, item.name, item.type, item.symbol);
        unit.setSearchTerm('');
      }}
      autoCapitalize="none"
      inlineMinSearchLength={1}
      maxResults={6}
      modalTitle={t('autocomplete.selectUnit')}
      modalSearchPlaceholder={t('labels.typeToSearchUnits')}
      modalEmptyText={t('autocomplete.noUnits')}
      modalEmptySubtext="Try a different search term"
      modalMinSearchLength={1}
      onSearchChange={unit.handleSearchTermChange}
    />
  );
};
