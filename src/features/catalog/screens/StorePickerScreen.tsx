import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import type { StaticScreenProps } from '@react-navigation/native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { SubScreen } from '#components/templates/SubScreen';
import { Dialog, DialogBody, DialogFooter } from '#components/templates/Dialog';
import { FormInput } from '#components/atoms/FormInput';
import type { ThemedTextInputRef } from '#components/atoms/themedComponents';
import { RowCard } from '#components/atoms/RowCard';
import { Text } from '#components/atoms/Text';
import { Button } from '#components/molecules/Button';
import { ListItem } from '#components/molecules/ListItem';
import { Loading } from '#components/molecules/Loading';
import { SearchBar } from '#components/molecules/SearchBar';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { useBudgetAndPricesEnabled } from '#hooks/settings/useBudgetAndPricesEnabled';
import { useReadingSystem } from '#hooks/settings/useReadingSystem';
import { toastService } from '#/services/toastService';
import { scheduleIdle } from '#/utils/scheduleIdle';
import type { StoreChoice } from '#domain/stores';
import { useCreateStore } from '#features/catalog/hooks/useCreateStore';
import { useNearMe } from '#features/catalog/hooks/useNearMe';
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
  const zipInput = useRef<ThemedTextInputRef>(null);
  const nearMe = useNearMe();
  const pricesShown = useBudgetAndPricesEnabled();
  // A decline offers the zip code instead, once the dialog or the OS prompt
  // has gone: a field under a closing window may not take the keyboard.
  useEffect(() => {
    if (nearMe.state !== 'declined') return;
    return scheduleIdle(() => zipInput.current?.focus());
  }, [nearMe.state]);
  // A whole zip wins; else the device's place, once the person asked for it.
  const search = useStoreSearch({
    household: { homeId },
    place: US_ZIP.test(zip)
      ? { zip }
      : nearMe.place
      ? { point: nearMe.place }
      : null,
    chains: true,
    markPrices: pricesShown,
    listBeforeTyping: false,
    maxResults: 20,
  });
  // Remembered once stores near it have been listed: a refused zip is not.
  const zipListed = US_ZIP.test(zip) && search.answered && !search.zipRefused;
  useEffect(() => {
    if (zipListed) setLastZip(zip);
  }, [zipListed, zip, setLastZip]);
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
  // A refused zip says why on its field, with nothing under it.
  const empty =
    !search.isOnline || search.zipRefused ? null : search.loading ? (
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
      <StoreList
        header={
          <>
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
                  ref={zipInput}
                  label={t('storePicker.zipLabel')}
                  value={zip}
                  onChangeText={text => {
                    setTypedZip(text.replace(/\D/g, '').slice(0, 5));
                  }}
                  keyboardType="number-pad"
                  textContentType="postalCode"
                  autoComplete="postal-code"
                  maxLength={5}
                  error={
                    search.zipRefused ? t('storePicker.zipRefused') : undefined
                  }
                  testID={catalogTestIDs.storePickerZip}
                />
                {nearMe.state === 'blocked' ? (
                  <>
                    <Text role="caption" tone="secondary">
                      {t('storePicker.locationOff')}
                    </Text>
                    <Button
                      variant="ghost"
                      size="small"
                      title={t('labels.openSettings')}
                      onPress={nearMe.openSettings}
                    />
                  </>
                ) : nearMe.state === 'declined' ? null : (
                  <>
                    {nearMe.state === 'failed' ? (
                      <Text role="caption" tone="secondary">
                        {t('storePicker.locationFailed')}
                      </Text>
                    ) : null}
                    <Button
                      variant="outline"
                      size="small"
                      icon="navigate-outline"
                      title={t('storePicker.nearMe')}
                      loading={nearMe.state === 'locating'}
                      onPress={() => {
                        setTypedZip('');
                        void nearMe.ask();
                      }}
                      testID={catalogTestIDs.storePickerNearMe}
                    />
                  </>
                )}
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
          </>
        }
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
            status={
              item.hasPrices
                ? { tone: 'info', text: t('storePicker.hasPrices') }
                : undefined
            }
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
      <Dialog
        visible={nearMe.state === 'explaining'}
        onRequestClose={nearMe.decline}
      >
        <DialogBody>
          <Text role="title">{t('storePicker.nearMeTitle')}</Text>
          <Text role="body" tone="secondary">
            {t('storePicker.nearMeBody')}
          </Text>
        </DialogBody>
        <DialogFooter>
          <Button
            variant="ghost"
            title={t('labels.notNow')}
            onPress={nearMe.decline}
          />
          <Button
            title={t('labels.continue')}
            onPress={() => {
              void nearMe.allow();
            }}
            testID={catalogTestIDs.storePickerNearMeContinue}
          />
        </DialogFooter>
      </Dialog>
    </SubScreen>
  );
};

const styles = StyleSheet.create(theme => ({
  offline: {
    gap: theme.spacing.xs,
  },
  note: {
    paddingVertical: theme.spacing.md,
  },
}));
