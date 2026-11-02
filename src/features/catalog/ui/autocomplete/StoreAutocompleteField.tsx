import { useTranslation } from '#/i18n';
import React from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';
import { useReadingSystem } from '#hooks/settings/useReadingSystem';
import { describeStoreOption, type StoreOption } from '#domain/stores';
import { GenericAutocompleteField } from '#features/catalog/components/AutocompleteField/GenericAutocompleteField';
import { AutocompleteRow } from '#features/catalog/components/AutocompleteField/AutocompleteRow';
import { useCreateStore } from '#features/catalog/hooks/useCreateStore';
import { useStoreSearch } from '#features/catalog/hooks/useStoreSearch';

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
  /** The field itself was finished: blurred or submitted. */
  onEndEditing?: () => void;
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
  onEndEditing,
}) => {
  const { t } = useTranslation();
  const readingSystem = useReadingSystem();
  const search = useStoreSearch();
  const { createStore } = useCreateStore();
  // Any name can be a store: the typed one is offered once its search answers.
  const term = search.term.trim();

  const choose = (id: string, name: string) => {
    onChangeText(name);
    onStoreSelected?.(id, name);
  };

  return (
    <>
      <GenericAutocompleteField<StoreOption>
        variant={variant}
        label={label}
        value={value}
        placeholder={placeholder}
        required={required}
        error={error}
        testID={testID}
        onChangeText={text => {
          onChangeText(text);
          search.setTerm(text);
          onStoreSelected?.(null, null);
        }}
        items={search.options}
        loading={search.loading}
        renderItem={item => (
          <AutocompleteRow {...describeStoreOption(item, t, readingSystem)} />
        )}
        keyExtractor={item => item.key}
        onSelect={({ choice }) => {
          search.clearTerm();
          if (choice.store) choose(choice.store.id, choice.store.name);
        }}
        showAddNew={search.unlistedName !== null}
        addNewLabel={t('labels.addNamed', { name: term })}
        onAddNew={() => {
          search.clearTerm();
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
        modalEmptySubtext={
          term.length < 2 ? t('autocomplete.typeAtLeastTwo') : undefined
        }
        modalMinSearchLength={2}
        onSearchChange={search.setTerm}
        onEndEditing={onEndEditing}
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
