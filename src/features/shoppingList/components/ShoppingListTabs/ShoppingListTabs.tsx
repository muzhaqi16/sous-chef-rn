import React, { useRef, useState } from 'react';
import {
  useWindowDimensions,
  View,
  Platform,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { ThemedRefreshControl } from '#components/atoms/themedComponents';
import { useTranslation } from '#/i18n';
import { ScrollView } from 'react-native-gesture-handler';
import { alertService } from '#/services/alertService';
import { TabView, type Route } from 'react-native-tab-view';
import { FilterTabBar } from './FilterTabBar';
import type { FilterTabActionButton } from '#components/molecules/FilterTabs/types';
import { ShoppingTab } from './ShoppingTab';
import { PurchasedTab } from './PurchasedTab';
import { EmptyState, type EmptyStateProps } from '#components/atoms/EmptyState';
import type { ShoppingListRowItem } from '../SortableShoppingList/types';
import type { SwipeableRef } from '#/components/molecules/SwipeableItem/types';
import { ItemSwipeActionsProvider } from '#components/organisms/itemSwipeActionsContext';
import type { ItemSwipeActionsFactory } from '#components/molecules/SwipeableItem/types';
import {
  ShoppingListTabsActionsProvider,
  type ShoppingListTabsActions,
} from './ShoppingListTabsActionsContext';
import {
  ShoppingListDataProvider,
  type ShoppingListTabData,
} from './ShoppingListDataContext';
import {
  useShoppingListTutorial,
  ShoppingListTutorialStep,
} from '#features/shoppingList/context/ShoppingListTutorialContext';

type ShoppingListTabId = 'shopping' | 'purchased';

interface TabRoute extends Route {
  key: ShoppingListTabId;
  title: string;
}

interface ShoppingListTabsProps {
  items?: ShoppingListRowItem[];
  // Pre-filtered upstream so the references stay stable; filtering here would
  // hand FlashList a new array every render.
  unpurchasedItems?: ShoppingListRowItem[];
  purchasedItems?: ShoppingListRowItem[];
  showImages?: boolean;
  // From GraphQL, not array length, so the badges survive pagination.
  totalCountUnpurchased?: number;
  totalCountPurchased?: number;
  onItemPress: (id: string) => void;
  itemSwipeActions?: ItemSwipeActionsFactory;
  onTogglePurchase?: (id: string, opts?: { withDetails?: boolean }) => void;
  onMoveToPantry?: (id: string) => void;
  onQuantityPress?: (id: string) => void;
  onSortOrderUpdate?: (
    itemId: string,
    afterItemId: string | null,
    beforeItemId: string | null,
  ) => void;
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
  loading?: boolean;
  disabled?: boolean;
  emptyState?: EmptyStateProps;
  onClearAllPurchased?: () => Promise<void>;
  onClearAllShopping?: () => Promise<void>;
  onSwipeableWillOpen?: (ref: SwipeableRef) => void;
  onSwipeableClose?: () => void;
  onCloseAllSwipeables?: () => void;
  onEndReachedUnpurchased?: () => void;
  hasMoreUnpurchased?: boolean;
  isLoadingMoreUnpurchased?: boolean;
  onEndReachedPurchased?: () => void;
  hasMorePurchased?: boolean;
  isLoadingMorePurchased?: boolean;
  canAddItems?: boolean;
  canRemoveItems?: boolean;
  canEditItems?: boolean;
  canMarkPurchased?: boolean;
  canReorderItems?: boolean;
  /** Drives the skeletons shown while switching lists. */
  isTransitioning?: boolean;
  onBatchMoveToPantry?: () => void;
  batchMoveToPantryLoading?: boolean;
  // Rendered inside FlashList so the RefreshControl sits in the right place.
  listHeaderComponent?: React.ReactElement | null;
  searchQuery?: string;
  // Collapsible scroll handlers — threaded to FlashList via data context.
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScrollBeginDrag?: () => void;
  onScrollEndDrag?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onMomentumScrollEnd?: () => void;
  scrollEventThrottle?: number;
}

// Stable tab key list for index lookups (titles come from i18n at render time).
const ROUTE_KEYS: ShoppingListTabId[] = ['shopping', 'purchased'];

// Module-level renderScene — data-free so TabView never re-calls it on data changes.
// Each tab reads its data from ShoppingListDataContext instead of props.
const renderSceneDataFree = ({ route }: { route: TabRoute }) => {
  switch (route.key) {
    case 'shopping':
      return <ShoppingTab />;
    case 'purchased':
      return <PurchasedTab />;
    default:
      return null;
  }
};

const ShoppingListTabs: React.FC<ShoppingListTabsProps> = ({
  items,
  unpurchasedItems: preFilteredUnpurchased,
  purchasedItems: preFilteredPurchased,
  totalCountUnpurchased,
  totalCountPurchased,
  onItemPress,
  itemSwipeActions,
  onTogglePurchase,
  onMoveToPantry,
  onQuantityPress,
  onSortOrderUpdate,
  onRefresh,
  refreshing,
  loading,
  disabled,
  emptyState,
  onClearAllPurchased,
  onClearAllShopping,
  onSwipeableWillOpen,
  onSwipeableClose,
  onCloseAllSwipeables,
  onEndReachedUnpurchased,
  hasMoreUnpurchased,
  isLoadingMoreUnpurchased,
  onEndReachedPurchased,
  hasMorePurchased,
  isLoadingMorePurchased,
  canRemoveItems = true,
  canEditItems = true,
  canMarkPurchased = true,
  canReorderItems = false,
  isTransitioning = false,
  onBatchMoveToPantry,
  batchMoveToPantryLoading = false,
  searchQuery,
  onScroll,
  onScrollBeginDrag,
  onScrollEndDrag,
  onMomentumScrollEnd,
  scrollEventThrottle,
  listHeaderComponent,
  showImages,
}) => {
  const { t } = useTranslation();
  const tabBarRef = useRef<View>(null);
  const layout = useWindowDimensions();
  const tutorial = useShoppingListTutorial();

  const routes: TabRoute[] = [
    { key: 'shopping', title: t('shoppingListScreen.tabShopping') },
    { key: 'purchased', title: t('shoppingListScreen.tabPurchased') },
  ];

  const [index, setIndex] = useState(0);
  /** Which scene the finger can actually reach — `swipeEnabled` is off. */
  const shoppingTabActive = index === 0;

  // Filtering here is the fallback; pre-filtered props keep stable references.
  const unpurchasedItems =
    preFilteredUnpurchased ?? (items?.filter(item => !item.isPurchased) || []);

  const purchasedItems =
    preFilteredPurchased ?? (items?.filter(item => item.isPurchased) || []);

  // Array length is the fallback; it only counts the loaded page.
  const unpurchasedCount = totalCountUnpurchased ?? unpurchasedItems.length;
  const purchasedCount = totalCountPurchased ?? purchasedItems.length;

  const handleIndexChange = (newIndex: number) => {
    onCloseAllSwipeables?.();
    // The outgoing list cannot report the end of a drag in flight, so end it
    // here or the tab bar keeps following a list the finger has left.
    onMomentumScrollEnd?.();
    setIndex(newIndex);
    if (newIndex === 1) {
      tutorial?.notifyPurchasedTabTapped();
    }
  };

  // Auto-switch to the purchased tab on the move-to-pantry step, via the
  // adjusting-state-during-render pattern rather than setState-in-effect.
  const [prevTutorialStep, setPrevTutorialStep] = useState(
    tutorial?.currentStep,
  );
  if (tutorial?.currentStep !== prevTutorialStep) {
    setPrevTutorialStep(tutorial?.currentStep);
    if (
      tutorial?.currentStep ===
      ShoppingListTutorialStep.SPOTLIGHT_MOVE_TO_PANTRY
    ) {
      setIndex(1);
    }
  }

  const shouldMeasurePurchasedTab =
    tutorial?.isActive &&
    tutorial.currentStep === ShoppingListTutorialStep.SPOTLIGHT_PURCHASED_TAB;

  const handleTabMeasure = (
    key: string,
    rect: { x: number; y: number; width: number; height: number },
  ) => {
    if (key === 'purchased') {
      tutorial?.registerRect('purchasedTab', rect);
    }
  };

  const tabActions: ShoppingListTabsActions = {
    onItemPress,
    onTogglePurchase,
    onMoveToPantry,
    onQuantityPress,
    onSortOrderUpdate,
    onSwipeableWillOpen,
    onSwipeableClose,
  };

  const confirmAction = (
    title: string,
    message: string,
    confirmText: string,
    onConfirm: () => void,
    destructive = true,
  ) => {
    alertService.alert(title, message, [
      { text: t('labels.cancel'), style: 'cancel' },
      {
        text: confirmText,
        style: destructive ? 'destructive' : 'default',
        onPress: onConfirm,
      },
    ]);
  };

  const handleClearAllWithConfirmation = () => {
    if (purchasedItems.length === 0) return;
    const count = purchasedItems.length;
    confirmAction(
      t('shoppingListTabs.clearPurchasedTitle'),
      t('shoppingListTabs.clearPurchasedBody', { count }),
      t('shoppingListTabs.clearAll'),
      () => {
        onClearAllPurchased?.();
      },
    );
  };

  const handleBatchMoveToPantryWithConfirmation = () => {
    if (purchasedItems.length === 0 || !onBatchMoveToPantry) return;
    const count = purchasedItems.length;
    confirmAction(
      t('shoppingListTabs.moveAllTitle'),
      t('shoppingListTabs.moveAllBody', { count }),
      t('shoppingListTabs.moveAll'),
      onBatchMoveToPantry,
      false,
    );
  };

  const handleClearAllShoppingWithConfirmation = () => {
    if (unpurchasedItems.length === 0) return;
    const count = unpurchasedItems.length;
    confirmAction(
      t('shoppingListTabs.clearShoppingTitle'),
      t('shoppingListTabs.clearShoppingBody', { count }),
      t('shoppingListTabs.clearAll'),
      () => {
        onClearAllShopping?.();
      },
    );
  };

  const currentClearHandler =
    index === 0
      ? handleClearAllShoppingWithConfirmation
      : handleClearAllWithConfirmation;

  const currentItems = index === 0 ? unpurchasedItems : purchasedItems;
  const showClear = canRemoveItems && currentItems.length > 0;

  const counts = {
    shopping: unpurchasedCount,
    purchased: purchasedCount,
  };

  const jumpTo = (key: string) => {
    const routeIndex = ROUTE_KEYS.indexOf(key as ShoppingListTabId);
    if (routeIndex >= 0) handleIndexChange(routeIndex);
  };

  const actionButtons: FilterTabActionButton[] = [];

  if (index === 1 && purchasedItems.length > 0 && onBatchMoveToPantry) {
    actionButtons.push({
      icon: 'archive-outline',
      onPress: handleBatchMoveToPantryWithConfirmation,
      disabled: batchMoveToPantryLoading,
      testID: 'shopping-list-batch-move-pantry',
    });
  }

  if (showClear) {
    actionButtons.push({
      label: t('labels.clear'),
      onPress: currentClearHandler,
      testID: 'shopping-list-clear-all',
    });
  }

  // The TabView's own tab bar, so it survives a tab falling back to its empty
  // state.
  const renderTabBar = () => (
    <View ref={tabBarRef} collapsable={false}>
      <FilterTabBar
        navigationState={{ index, routes }}
        jumpTo={jumpTo}
        counts={counts}
        actionButtons={actionButtons.length > 0 ? actionButtons : undefined}
        onTabMeasure={shouldMeasurePurchasedTab ? handleTabMeasure : undefined}
        measureTabKeys={shouldMeasurePurchasedTab ? ['purchased'] : undefined}
      />
    </View>
  );

  // Kept out of renderScene so TabView never re-calls it on a data change,
  // which would destroy the FlashList recycling pools.
  const shoppingTabData: ShoppingListTabData = {
    items: unpurchasedItems,
    showImages,
    onRefresh,
    refreshing,
    loading,
    disabled,
    onEndReached: onEndReachedUnpurchased,
    hasMore: hasMoreUnpurchased,
    isLoadingMore: isLoadingMoreUnpurchased,
    canRemoveItems,
    canEditItems,
    canMarkPurchased,
    canReorderItems,
    isTransitioning,
    // Only the visible tab drives the tab bar. `lazy` keeps both scenes mounted
    // once visited, so a hidden list's layout or restore scroll would otherwise
    // feed the same direction tracking as the one under the finger.
    onScroll: shoppingTabActive ? onScroll : undefined,
    onScrollBeginDrag: shoppingTabActive ? onScrollBeginDrag : undefined,
    onScrollEndDrag: shoppingTabActive ? onScrollEndDrag : undefined,
    onMomentumScrollEnd: shoppingTabActive ? onMomentumScrollEnd : undefined,
    scrollEventThrottle,
    listHeaderComponent,
  };

  const purchasedTabData: ShoppingListTabData = {
    items: purchasedItems,
    showImages,
    onRefresh,
    refreshing,
    loading,
    disabled,
    onEndReached: onEndReachedPurchased,
    hasMore: hasMorePurchased,
    isLoadingMore: isLoadingMorePurchased,
    canRemoveItems,
    canEditItems,
    canMarkPurchased,
    canReorderItems: false,
    isTransitioning,
    onScroll: shoppingTabActive ? undefined : onScroll,
    onScrollBeginDrag: shoppingTabActive ? undefined : onScrollBeginDrag,
    onScrollEndDrag: shoppingTabActive ? undefined : onScrollEndDrag,
    onMomentumScrollEnd: shoppingTabActive ? undefined : onMomentumScrollEnd,
    scrollEventThrottle,
    listHeaderComponent,
  };

  const tabData = {
    shopping: shoppingTabData,
    purchased: purchasedTabData,
    searchQuery: searchQuery ?? '',
  };

  // Only once loading settles with both tabs empty: a list switch empties them
  // briefly, and an active search has its own per-tab messaging.
  const showEmptyState =
    !loading &&
    !refreshing &&
    !isTransitioning &&
    !searchQuery?.trim() &&
    unpurchasedItems.length === 0 &&
    purchasedItems.length === 0 &&
    !!emptyState;

  return (
    <ShoppingListTabsActionsProvider actions={tabActions}>
      {/* A value, not a ref: rows call it while rendering. */}
      <ItemSwipeActionsProvider value={itemSwipeActions}>
        <ShoppingListDataProvider data={tabData}>
          <View
            style={{
              flex: 1,
              ...(Platform.OS === 'android' && { elevation: 0 }),
            }}
          >
            {showEmptyState ? (
              <ScrollView
                contentContainerStyle={{ flex: 1 }}
                refreshControl={
                  onRefresh ? (
                    <ThemedRefreshControl
                      refreshing={refreshing || false}
                      onRefresh={onRefresh}
                    />
                  ) : undefined
                }
              >
                {renderTabBar()}
                <EmptyState {...emptyState} />
              </ScrollView>
            ) : (
              <TabView
                navigationState={{ index, routes }}
                renderScene={renderSceneDataFree}
                renderTabBar={renderTabBar}
                onIndexChange={handleIndexChange}
                initialLayout={{ width: layout.width }}
                swipeEnabled={false}
                lazy={true}
                overScrollMode="never"
              />
            )}
          </View>
        </ShoppingListDataProvider>
      </ItemSwipeActionsProvider>
    </ShoppingListTabsActionsProvider>
  );
};

export { ShoppingListTabs };
