import React from 'react';
import type { StaticScreenProps } from '@react-navigation/native';
import { Pressable } from 'react-native-gesture-handler';
import {
  useTranslation,
  type TranslateFn,
  type TranslationKey,
} from '#/i18n';
import { UsualStoreSource } from '#/graphql/generated/schemaTypes';
import { SubScreen } from '#components/templates/SubScreen';
import { Icon } from '#components/atoms/Icon';
import { deleteAction } from '#components/organisms/SwipeableItem/commonActions';
import type { SwipeAction } from '#components/organisms/SwipeableItem/types';
import { useDataState } from '#hooks/data/useDataState';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { useReadingSystem } from '#hooks/settings/useReadingSystem';
import { toastService } from '#/services/toastService';
import { hitSlop } from '#/theme/foundations/sizes';
import { formatMonthDay } from '#/utils/formatters/date';
import { storeChoiceName } from '#domain/stores';
import {
  useUsualStores,
  type UsualStoreRow,
} from '#features/catalog/hooks/useUsualStores';
import { useUsualStoreWrites } from '#features/catalog/hooks/useUsualStoreWrites';
import { StoreList } from '#features/catalog/ui/StoreList';
import { StoreRow } from '#features/catalog/ui/StoreRow';
import { catalogTestIDs } from '#features/catalog/testIDs';

const ADDED_VIA: Record<UsualStoreSource, TranslationKey> = {
  [UsualStoreSource.Receipt]: 'usualStores.addedViaReceipt',
  [UsualStoreSource.Purchase]: 'usualStores.addedViaPurchase',
  [UsualStoreSource.ListStore]: 'usualStores.addedViaListStore',
  [UsualStoreSource.Picked]: 'usualStores.addedViaPicked',
};

/** Pinned; else not compared; else how it came and when it was last used. */
const statusOf = (row: UsualStoreRow, t: TranslateFn): string => {
  if (row.pinned) return t('usualStores.pinned');
  if (!row.compared) return t('usualStores.notCompared');
  return [
    t(ADDED_VIA[row.addedVia]),
    row.lastUsedAt &&
      t('usualStores.lastUsed', {
        date: formatMonthDay(new Date(row.lastUsedAt)),
      }),
  ]
    .filter(part => typeof part === 'string')
    .join(' · ');
};

/**
 * The stores a household shops at, which its price comparisons use. Every
 * member sees the same list and can pin or remove a store, or add one.
 */
export const UsualStoresScreen: React.FC<
  StaticScreenProps<{ homeId: string | null }>
> = ({ route }) => {
  useScreenTransition('UsualStoresScreen');
  const { t } = useTranslation();
  const { homeId } = route.params;
  const { toStorePicker } = useAppNavigation();
  const { stores, loading, error, refetch } = useUsualStores(homeId, {
    fetchPolicy: 'cache-and-network',
  });
  const writes = useUsualStoreWrites(homeId);
  const readingSystem = useReadingSystem();
  const state = useDataState({
    loading,
    error,
    hasResult: !!stores,
    isEmpty: stores?.length === 0,
  });
  const addStore = () => {
    toStorePicker({ homeId });
  };

  const remove = (row: UsualStoreRow) => {
    void writes.remove(row.choice);
    toastService.success(
      t('usualStores.removed', { name: storeChoiceName(row.choice, t) }),
      {
        action: {
          label: t('labels.undo'),
          onPress: () => {
            void writes.add(row.choice);
          },
        },
      },
    );
  };

  return (
    <SubScreen
      title={t('usualStores.title')}
      actions={[
        {
          icon: 'add',
          accessibilityLabel: t('usualStores.addStore'),
          onPress: addStore,
          testID: catalogTestIDs.usualStoresAdd,
        },
      ]}
      scroll="list"
      gutter="none"
      state={{
        value: state,
        onRetry: () => {
          void refetch();
        },
        empty: {
          icon: 'storefront-outline',
          title: t('usualStores.emptyTitle'),
          description: t('usualStores.emptyBody'),
          action: { label: t('usualStores.addStore'), onPress: addStore },
        },
      }}
      testID={catalogTestIDs.usualStoresScreen}
    >
      <StoreList
        data={stores ?? []}
        renderItem={({ item }) => {
          const pin: SwipeAction = {
            key: item.pinned ? 'unpin' : 'pin',
            icon: item.pinned ? 'pin' : 'pin-outline',
            labelKey: item.pinned ? 'usualStores.unpin' : 'usualStores.pin',
            onPress: () => {
              void writes.setPinned(item.choice, !item.pinned);
            },
          };
          return (
            <StoreRow
              option={item}
              readingSystem={readingSystem}
              status={{
                tone: item.compared ? 'neutral' : 'warning',
                text: statusOf(item, t),
              }}
              swipe={{
                testIDPrefix: catalogTestIDs.usualStoreRow(item.key),
                left: [pin],
                right: [
                  {
                    ...deleteAction(() => {
                      remove(item);
                    }),
                    key: 'remove',
                    labelKey: 'labels.remove',
                  },
                ],
              }}
              trailing={
                // RNGH's, so the row's swipe does not also take the tap.
                <Pressable
                  onPress={pin.onPress}
                  hitSlop={hitSlop.md}
                  accessibilityRole="button"
                  accessibilityLabel={t(pin.labelKey)}
                  accessibilityState={{ selected: item.pinned }}
                  testID={catalogTestIDs.usualStorePin(item.key)}
                >
                  <Icon
                    name={pin.icon}
                    size={22}
                    tone={item.pinned ? 'primary' : 'textSecondary'}
                  />
                </Pressable>
              }
            />
          );
        }}
      />
    </SubScreen>
  );
};
