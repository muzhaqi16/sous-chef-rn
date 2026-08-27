import { useTranslation } from '#/i18n';
import React from 'react';
import { StyleSheet } from 'react-native-unistyles';
import {
  useStoreAutocomplete,
  type StoreItem,
} from '#features/catalog/hooks/useStoreAutocomplete';
import { Text } from '#components/atoms/Text';
import { GenericAutocompleteField } from '#components/molecules/AutocompleteField/GenericAutocompleteField';
import { AutocompleteRow } from '#components/molecules/AutocompleteField/AutocompleteRow';

interface StoreAutocompleteFieldProps {
  variant: 'inline' | 'modal';
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  testID?: string;
  onStoreSelected?: (storeId: string | null, storeName: string | null) => void;
  /**
   * Optional hint shown under the field. The store is saved by id only — a typed
   * name that isn't picked from the suggestions is dropped — so callers pass this
   * to tell the user to choose from the list.
   */
  helperText?: string;
}

export const StoreAutocompleteField: React.FC<StoreAutocompleteFieldProps> = ({
  variant,
  label,
  value,
  onChangeText,
  placeholder,
  required,
  error,
  testID,
  onStoreSelected,
  helperText,
}) => {
  const { t } = useTranslation();
  const store = useStoreAutocomplete();

  return (
    <>
      <GenericAutocompleteField<StoreItem>
        variant={variant}
        label={label}
        value={value}
        placeholder={placeholder}
        required={required}
        error={error}
        testID={testID}
        onChangeText={text => {
          onChangeText(text);
          store.handleSearchTermChange(text);
          onStoreSelected?.(null, null);
        }}
        items={store.displayItems}
        loading={store.isLoading}
        renderItem={item => (
          <AutocompleteRow
            title={item.name}
            subtitle={item.address || undefined}
          />
        )}
        keyExtractor={item => item.id}
        onSelect={item => {
          onChangeText(item.name);
          onStoreSelected?.(item.id, item.name);
          store.setSearchTerm('');
        }}
        autoCapitalize="words"
        inlineMinSearchLength={2}
        maxResults={6}
        modalTitle={t('autocomplete.selectStore')}
        modalSearchPlaceholder={t('autocomplete.storeSearch')}
        modalEmptyText={t('autocomplete.noStores')}
        modalEmptySubtext={
          store.shouldSearch
            ? t('autocomplete.typeMoreToAddStore', { term: store.searchTerm })
            : t('autocomplete.typeAtLeastTwo')
        }
        modalMinSearchLength={2}
        onSearchChange={store.handleSearchTermChange}
      />
      {helperText ? (
        <Text size="sm" tone="tertiary" style={styles.helper}>
          {helperText}
        </Text>
      ) : null}
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  helper: {
    marginTop: theme.spacing.xs,
  },
}));
