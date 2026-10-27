import React, { useState } from 'react';
import type { StaticScreenProps } from '@react-navigation/native';
import { useKeepAwake } from '@sayem314/react-native-keep-awake';
import { useTranslation } from '#/i18n';
import { SubScreen } from '#components/templates/SubScreen';
import type { BarAction } from '#components/molecules/BarActions';
import { Loading } from '#components/molecules/Loading';
import { EmptyState } from '#components/molecules/EmptyState';
import { DataStateView } from '#components/organisms/DataStateView';
import type { SwipeAction } from '#components/organisms/SwipeableItem/types';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useOfflineAwareError } from '#hooks/app/useOfflineAwareError';
import { useScreenTelemetry } from '#hooks/performance/useScreenTelemetry';
import { useShowShoppingListImages } from '#hooks/settings/useUserPreferences';
import { executeRefreshWithFinally } from '#/utils/finallyHelpers';
import { SortableShoppingList } from '#features/shoppingList/components/SortableShoppingList/SortableList';
import { StoreModeHeader } from '#features/shoppingList/components/storeMode/StoreModeHeader';
import { ShoppingListPermissionsProvider } from '#features/shoppingList/context/ShoppingListPermissionsContext';
import {
  ShoppingListModalsProvider,
  useShoppingListModalActions,
} from '#features/shoppingList/context/ShoppingListModalsContext';
import { useStoreMode } from '#features/shoppingList/screens/useStoreMode';
import { shoppingListTestIDs } from '#features/shoppingList/testIDs';

type StoreModeProps = StaticScreenProps<{ listId: string }>;

const noop = () => {};

/** The list and its header; inside the providers, so it can open their sheets. */
const StoreModeBody: React.FC<{
  listId: string;
  storeMode: ReturnType<typeof useStoreMode>;
}> = ({ listId, storeMode: { state, actions } }) => {
  const { t } = useTranslation();
  const { goBack, toShoppingListItemDetail } = useAppNavigation();
  const { openMoveToAisle, openPurchaseAmount, openQuantityEdit } =
    useShoppingListModalActions();
  const showImages = useShowShoppingListImages();
  const [refreshing, setRefreshing] = useState(false);

  const failure = useOfflineAwareError(
    state.error,
    state.rows.length > 0 || state.cartCount > 0,
  );
  if (state.loading) return <Loading />;
  if (failure.offline || failure.error) {
    return (
      <DataStateView
        state={failure.offline ? 'offline' : 'error'}
        onRetry={actions.refetch}
      />
    );
  }

  const inCart = state.tab === 'cart';
  const moveToAisle = (id: string): SwipeAction => ({
    key: 'aisle',
    icon: 'storefront-outline',
    labelKey: 'shoppingListScreens.aisles.move',
    onPress: () => openMoveToAisle(id),
  });

  return (
    <>
      <StoreModeHeader
        cartCount={state.cartCount}
        totalCount={state.totalCount}
        estimate={state.estimate}
        storeName={state.storeName}
        canChooseStore={state.canChooseStore}
        onChooseStore={actions.chooseStore}
        routeNote={state.routeNote}
        aisles={state.aisles}
        lineCount={state.lineCount}
        tab={state.tab}
        onTabChange={actions.setTab}
      />
      <SortableShoppingList
        perfName="StoreModeList"
        items={state.rows}
        showImages={showImages}
        reorderable={false}
        onItemPress={id => toShoppingListItemDetail({ listId, itemId: id })}
        itemSwipeActions={id =>
          inCart ? undefined : { left: [moveToAisle(id)] }
        }
        onTogglePurchase={(id, opts) => {
          // A long-press records what the line cost; the cart has nothing to record.
          if (opts?.withDetails) {
            if (!inCart) openPurchaseAmount(id);
            return;
          }
          void actions.toggleLine(id);
        }}
        onQuantityPress={inCart ? undefined : openQuantityEdit}
        onEndReached={inCart ? actions.loadMoreCart : undefined}
        refreshing={refreshing}
        onRefresh={() =>
          executeRefreshWithFinally(() => actions.refetch(), setRefreshing)
        }
        ListEmptyComponent={
          inCart ? (
            <EmptyState
              icon="cart-outline"
              title={t('shoppingListScreens.storeMode.cartEmpty')}
            />
          ) : (
            <EmptyState
              icon="checkmark-done-outline"
              title={t('shoppingListScreens.storeMode.allDone')}
              description={t('shoppingListScreens.storeMode.allDoneHint', {
                done: t('labels.done'),
              })}
              action={{ label: t('labels.done'), onPress: goBack }}
            />
          )
        }
      />
    </>
  );
};

/**
 * Store mode: one list walked aisle by aisle in the store's order, the screen
 * kept awake. Opt-in from Settings while it is measured against the list.
 */
export const StoreMode: React.FC<StoreModeProps> = ({ route }) => {
  const { listId } = route.params;
  const { t } = useTranslation();
  const { goBack, toListSettings, toBarcode } = useAppNavigation();
  useKeepAwake();

  const storeMode = useStoreMode(listId);
  const { state, actions } = storeMode;
  const scanAction: BarAction[] = state.permissions.canMarkPurchased
    ? [
        {
          icon: 'barcode-outline',
          accessibilityLabel: t('labels.scanBarcode'),
          onPress: () =>
            toBarcode({ source: 'storeMode', shoppingListId: listId }),
          testID: shoppingListTestIDs.storeModeScan,
        },
      ]
    : [];

  useScreenTelemetry(
    'StoreMode',
    () => ({
      list_id: listId,
      line_count: state.lineCount,
      aisle_count: state.aisles.length,
      cart_count: state.cartCount,
    }),
    !state.loading,
  );

  return (
    <SubScreen
      testID={shoppingListTestIDs.storeModeScreen}
      title={state.listName ?? t('labels.shoppingList')}
      actions={[
        ...scanAction,
        {
          label: t('labels.done'),
          variant: 'primary',
          onPress: goBack,
          testID: shoppingListTestIDs.storeModeDone,
        },
      ]}
      scroll="list"
      gutter="none"
    >
      <ShoppingListPermissionsProvider permissions={state.permissions}>
        <ShoppingListModalsProvider
          currentListId={listId}
          items={state.items}
          recordPurchase={actions.recordPurchase}
          searchQuery=""
          onSearchQueryClear={noop}
          onNavigateToListSettings={() => toListSettings({ listId })}
        >
          <StoreModeBody listId={listId} storeMode={storeMode} />
        </ShoppingListModalsProvider>
      </ShoppingListPermissionsProvider>
    </SubScreen>
  );
};
