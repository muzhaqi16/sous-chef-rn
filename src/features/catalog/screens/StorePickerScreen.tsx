import React, { useState } from 'react';
import { View } from 'react-native';
import type { StaticScreenProps } from '@react-navigation/native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { SubScreen } from '#components/templates/SubScreen';
import { FormInput } from '#components/atoms/FormInput';
import { RowCard } from '#components/atoms/RowCard';
import { Text } from '#components/atoms/Text';
import { ListItem } from '#components/molecules/ListItem';
import { Loading } from '#components/molecules/Loading';
import { SearchBar } from '#components/molecules/SearchBar';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { useReadingSystem } from '#hooks/settings/useReadingSystem';
import { toastService } from '#/services/toastService';
import type { StoreChoice } from '#domain/stores';
import { useCreateStore } from '#features/catalog/hooks/useCreateStore';
import { useStoreSearch } from '#features/catalog/hooks/useStoreSearch';
import { useUsualStoreWrites } from '#features/catalog/hooks/useUsualStoreWrites';
import { useStorePickerStore } from '#features/catalog/store/storePickerStore';
import { StoreList } from '#features/catalog/ui/StoreList';
import { StoreRow } from '#features/catalog/ui/StoreRow';
import { catalogTestIDs } from '#features/catalog/testIDs';

const US_ZIP = /^\d{5}$/;

/**
 * Finds a store to add to the household's: near a zip code, by name or
 * address, a whole chain, or one the app does not know, added by its name for
 * this household alone. Offline it lists the household's stores.
 */
export const StorePickerScreen: React.FC<
  StaticScreenProps<{ homeId: string | null }>
> = ({ route }) => {
  useScreenTransition('StorePickerScreen');
  const { t } = useTranslation();
  const { homeId } = route.params;
  const { goBack } = useAppNavigation();
  const readingSystem = useReadingSystem();
  const lastZip = useStorePickerStore(state => state.lastZip);
  const setLastZip = useStorePickerStore(state => state.setLastZip);
  // Null until typed: the stored zip fills the field, hydrated or not yet.
  const [typedZip, setTypedZip] = useState<string | null>(null);
  const zip = typedZip ?? lastZip ?? '';
  const search = useStoreSearch({
    household: { homeId },
    place: US_ZIP.test(zip) ? { zip } : null,
    chains: true,
    maxResults: 20,
  });
  const writes = useUsualStoreWrites(homeId);
  const { createStore } = useCreateStore();

  const add = async (choice: StoreChoice) => {
    if (!(await writes.add(choice))) return;
    toastService.success(t('storePicker.addedToStores'));
    goBack();
  };

  // A name alone with this home is the household's own label; a later receipt
  // from the same shop turns it into the real store.
  const addUnlisted = async (name: string) => {
    const created = await createStore({ name, homeId });
    if (created) await add({ store: created });
  };

  const term = search.term.trim();
  const empty = !search.isOnline ? null : search.loading ? (
    <Loading size="small" />
  ) : (
    <Text role="body" tone="secondary" style={styles.note}>
      {!search.answered
        ? t('storePicker.hint')
        : term
        ? t('storePicker.nothingNamed', { term })
        : t('storePicker.nothingNear')}
    </Text>
  );
  const unlisted = search.isOnline ? search.unlistedName : null;

  return (
    <SubScreen
      title={t('usualStores.addStore')}
      scroll="list"
      gutter="none"
      testID={catalogTestIDs.storePickerScreen}
    >
      <View style={styles.fields}>
        {search.isOnline ? (
          <>
            <SearchBar
              value={search.term}
              onChangeText={search.setTerm}
              placeholder={t('storePicker.searchPlaceholder')}
              isLoading={search.loading}
              testID={catalogTestIDs.storePickerSearch}
            />
            <FormInput
              label={t('storePicker.zipLabel')}
              value={zip}
              onChangeText={text => {
                const digits = text.replace(/\D/g, '').slice(0, 5);
                setTypedZip(digits);
                if (US_ZIP.test(digits)) setLastZip(digits);
              }}
              keyboardType="number-pad"
              textContentType="postalCode"
              autoComplete="postal-code"
              maxLength={5}
              error={search.zipRefused ? t('storePicker.zipRefused') : undefined}
              testID={catalogTestIDs.storePickerZip}
            />
          </>
        ) : (
          <View style={styles.offline}>
            <Text role="bodyStrong">
              {t('storePicker.needsConnectionTitle')}
            </Text>
            <Text role="body" tone="secondary">
              {t('storePicker.needsConnectionBody')}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.listHost}>
        <StoreList
          data={search.options}
          ListEmptyComponent={empty}
          ListFooterComponent={
            unlisted ? (
              <RowCard>
                <ListItem
                  leftIcon="add-circle-outline"
                  title={t('storePicker.notListed', { name: unlisted })}
                  accessibilityHint=""
                  onPress={() => {
                    void addUnlisted(unlisted);
                  }}
                />
              </RowCard>
            ) : null
          }
          renderItem={({ item }) => (
            <StoreRow
              option={item}
              readingSystem={readingSystem}
              markAdded
              onPress={
                item.added
                  ? undefined
                  : () => {
                      void add(item.choice);
                    }
              }
              testID={catalogTestIDs.storePickerRow(item.key)}
            />
          )}
        />
      </View>
    </SubScreen>
  );
};

const styles = StyleSheet.create(theme => ({
  fields: {
    paddingHorizontal: theme.layout.pageGutter,
    paddingTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  offline: {
    gap: theme.spacing.xs,
  },
  listHost: {
    flex: 1,
  },
  note: {
    paddingVertical: theme.spacing.md,
  },
}));
