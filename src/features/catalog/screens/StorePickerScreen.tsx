import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import type { StaticScreenProps } from '@react-navigation/native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { SubScreen } from '#components/templates/SubScreen';
import { Dialog, DialogBody, DialogFooter } from '#components/templates/Dialog';
import { FormInput } from '#components/atoms/FormInput';
import { Link } from '#components/atoms/Link';
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
import {
  chainOption,
  storeOption,
  type FoundOption,
  type StoreChoice,
} from '#domain/stores';
import { useNearMe } from '#features/catalog/hooks/useNearMe';
import { useStoreSearch } from '#features/catalog/hooks/useStoreSearch';
import {
  unlistedKey,
  useStorePicks,
  type Tapped,
} from '#features/catalog/hooks/useStorePicks';
import { useStorePickerStore } from '#features/catalog/store/storePickerStore';
import { StoreList } from '#features/catalog/ui/StoreList';
import { StoreRow } from '#features/catalog/ui/StoreRow';
import { catalogTestIDs } from '#features/catalog/testIDs';

const US_ZIP = /^\d{5}$/;
const OPENSTREETMAP_COPYRIGHT = 'https://www.openstreetmap.org/copyright';

const optionOf = (choice: StoreChoice): FoundOption =>
  choice.store ? storeOption(choice.store) : chainOption(choice.chain);

/**
 * Finds a store to add to the household's: near a zip code, by name or
 * address, a whole chain, or one the app does not know, added by its name for
 * this household alone. Offline it lists the household's stores. With
 * `several`, each tap adds a store and the picker stays open until Done.
 */
export const StorePickerScreen: React.FC<
  StaticScreenProps<{ homeId: string | null; several?: boolean }>
> = ({ route }) => {
  useScreenTransition('StorePickerScreen');
  const { t } = useTranslation();
  const { homeId, several = false } = route.params;
  const { goBack } = useAppNavigation();
  const readingSystem = useReadingSystem();
  const lastZip = useStorePickerStore(state => state.lastZip);
  const setLastZip = useStorePickerStore(state => state.setLastZip);
  // Null until typed: the stored zip fills the field, hydrated or not yet.
  const [typedZip, setTypedZip] = useState<string | null>(null);
  const zip = typedZip ?? lastZip ?? '';
  const zipInput = useRef<ThemedTextInputRef>(null);
  const nearMe = useNearMe();
  // A found place takes over from the zip; a read that fails leaves it.
  const [prevPlace, setPrevPlace] = useState(nearMe.place);
  if (nearMe.place !== prevPlace) {
    setPrevPlace(nearMe.place);
    if (nearMe.place) setTypedZip('');
  }
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
  const picks = useStorePicks({
    homeId,
    several,
    onAdded: () => {
      toastService.success(t('storePicker.addedToStores'));
      goBack();
    },
  });

  const term = search.term.trim();
  // A refused zip says why on its field, with nothing under it.
  const empty =
    search.isOffline || search.zipRefused ? null : search.loading ? (
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
  const unlisted = search.isOffline ? null : search.unlistedName;
  // The row that adds a store needs a typed name, so a list near a place says so.
  const canTypeToAdd =
    search.answered && !term && !search.isOffline && !search.zipRefused;
  const busy = <Loading size="small" />;
  // A name added this visit reads as its store, so it can be taken back.
  const unlistedPick = unlisted
    ? picks.pickOf(unlistedKey(unlisted))
    : undefined;

  const row = (option: FoundOption, tapped: Tapped, testID: string) => {
    const pick = picks.pickOf(option.key);
    const added = option.added || !!pick;
    return (
      <StoreRow
        option={{ ...option, added }}
        readingSystem={readingSystem}
        markAdded
        status={
          option.hasPrices
            ? { tone: 'info', text: t('storePicker.hasPrices') }
            : undefined
        }
        trailing={picks.isSettling(option.key) ? busy : undefined}
        onPress={picks.pressFor(option.key, tapped, added)}
        accessibilityHint={
          pick?.ours ? t('storePicker.takeBackHint') : undefined
        }
        testID={testID}
      />
    );
  };

  return (
    <SubScreen
      title={t('usualStores.addStore')}
      actions={
        several
          ? [
              {
                label: t('labels.done'),
                variant: 'primary',
                onPress: goBack,
                testID: catalogTestIDs.storePickerDone,
              },
            ]
          : undefined
      }
      scroll="list"
      gutter="none"
      testID={catalogTestIDs.storePickerScreen}
    >
      <StoreList
        header={
          <>
            {!search.isOffline ? (
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
                        void nearMe.ask();
                      }}
                      testID={catalogTestIDs.storePickerNearMe}
                    />
                  </>
                )}
                {search.credit ? (
                  <Link variant="caption" href={OPENSTREETMAP_COPYRIGHT}>
                    {search.credit}
                  </Link>
                ) : null}
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
          unlistedPick ? (
            row(
              optionOf(unlistedPick.choice),
              unlistedPick.choice,
              catalogTestIDs.storePickerUnlisted,
            )
          ) : unlisted ? (
            <RowCard testID={catalogTestIDs.storePickerUnlisted}>
              <ListItem
                leftIcon="add-circle-outline"
                title={t('storePicker.notListed', { name: unlisted })}
                rightElement={
                  picks.isSettling(unlistedKey(unlisted)) ? busy : undefined
                }
                accessibilityHint=""
                onPress={picks.pressFor(
                  unlistedKey(unlisted),
                  { unlisted },
                  false,
                )}
              />
            </RowCard>
          ) : canTypeToAdd ? (
            <Text role="body" tone="secondary" style={styles.note}>
              {t('storePicker.typeToAdd')}
            </Text>
          ) : null
        }
        renderItem={({ item }) =>
          row(item, item.choice, catalogTestIDs.storePickerRow(item.key))
        }
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
