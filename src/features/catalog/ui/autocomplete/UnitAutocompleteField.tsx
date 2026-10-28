import { useTranslation } from '#/i18n';
import React from 'react';
import {
  useUnitAutocomplete,
  type UnitItem,
} from '#features/catalog/hooks/useUnitAutocomplete';
import { GenericAutocompleteField } from '#features/catalog/components/AutocompleteField/GenericAutocompleteField';
import { AutocompleteRow } from '#features/catalog/components/AutocompleteField/AutocompleteRow';
import type { UnitType } from '#/graphql/generated/schemaTypes';
import { unitLabel } from '#/utils/formatQuantity';

interface UnitAutocompleteFieldProps {
  variant: 'inline' | 'modal';
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  testID?: string;
  /** The picked unit's name and short form, in the app's language. */
  onUnitSelected?: (
    unitId: string | null,
    unitName: string | null,
    unitType?: UnitType | null,
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
          // Where the short form is the name ("cucchiaio"), it shows once.
          symbolText={
            unitLabel(item) === unitLabel(item, { form: 'name' })
              ? undefined
              : unitLabel(item)
          }
          title={unitLabel(item, { form: 'name' })}
          trailingText={
            item.abbreviation ? `(${item.abbreviation})` : undefined
          }
        />
      )}
      keyExtractor={item => item.id}
      onSelect={item => {
        onChangeText(unitLabel(item));
        onUnitSelected?.(
          item.id,
          unitLabel(item, { form: 'name' }),
          item.type,
          unitLabel(item),
        );
        unit.setSearchTerm('');
      }}
      autoCapitalize="none"
      inlineMinSearchLength={1}
      maxResults={6}
      modalTitle={t('autocomplete.selectUnit')}
      modalSearchPlaceholder={t('labels.typeToSearchUnits')}
      modalEmptyText={t('autocomplete.noUnits')}
      modalEmptySubtext={t('autocomplete.tryDifferentTerm')}
      modalMinSearchLength={1}
      onSearchChange={unit.handleSearchTermChange}
    />
  );
};
