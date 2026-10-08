import { useTranslation } from '#/i18n';
import React from 'react';
import { StyleSheet } from 'react-native-unistyles';
import {
  useStoreAutocomplete,
  type StoreItem,
} from '#features/catalog/hooks/useStoreAutocomplete';
import { Text } from '#components/atoms/Text';
import { GenericAutocompleteField } from '#features/catalog/components/AutocompleteField/GenericAutocompleteField';
import { AutocompleteRow } from '#features/catalog/components/AutocompleteField/AutocompleteRow';
import { firstNonBlank } from '#/utils/firstNonBlank';
import { useCreateStore } from '#features/catalog/hooks/useCreateStore';

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
  const { createStore } = useCreateStore();

  // Any name can be a store: the typed one is offered once the search for it
  // has answered, unless a store of that name is listed.
  const term = store.searchTerm.trim();
  const offersNew =
    term.length >= 2 &&
    !store.searchPending &&
    !store.displayItems.some(
      item => item.name.trim().toLowerCase() === term.toLowerCase(),
    );

  const choose = (id: string, name: string) => {
    onChangeText(name);
    onStoreSelected?.(id, name);
  };

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
            subtitle={firstNonBlank(item.address)}
          />
        )}
        keyExtractor={item => item.id}
        onSelect={item => {
          store.setSearchTerm('');
          choose(item.id, item.name);
        }}
        showAddNew={offersNew}
        addNewLabel={t('labels.addNamed', { name: term })}
        onAddNew={() => {
          store.setSearchTerm('');
          void createStore({ name: term }).then(created => {
            if (created) choose(created.id, created.name);
          });
        }}
        autoCapitalize="words"
        inlineMinSearchLength={2}
        maxResults={6}
        modalTitle={t('autocomplete.selectStore')}
        modalSearchPlaceholder={t('autocomplete.storeSearch')}
        modalEmptyText={t('autocomplete.noStores')}
        modalEmptySubtext={t('autocomplete.typeAtLeastTwo')}
        modalMinSearchLength={2}
        onSearchChange={store.handleSearchTermChange}
      />
      {helperText ? (
        <Text role="caption" tone="tertiary" style={styles.helper}>
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
