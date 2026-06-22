import React, { useRef, useState } from 'react';
import {
  useWindowDimensions,
  View,
  Platform,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { ThemedRefreshControl } from '#components/atoms/themedComponents';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native-gesture-handler';
import { alertService } from '#/services/alertService';
import { TabView, type Route } from 'react-native-tab-view';
import { FilterTabBar } from './FilterTabBar';
import type { FilterTabActionButton } from '#components/molecules/FilterTabs/types';
import { ShoppingTab } from './ShoppingTab';
import { PurchasedTab } from './PurchasedTab';
import { EmptyState, type EmptyStateProps } from '#components/base/EmptyState';
import type { ShoppingListRowItem } from '../SortableShoppingList/types';
import type { SwipeableRef } from '#/components/molecules/SwipeableItem/types';
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
  // PERFORMANCE: Pre-filtered items with stable references from useShoppingListScreen
  // When provided, skip internal filtering to prevent new array references
  unpurchasedItems?: ShoppingListRowItem[];
  purchasedItems?: ShoppingListRowItem[];
  /** Whether row cells render product images (threaded into tab data context) */
  showImages?: boolean;
  // Total counts from GraphQL (not array length) for accurate tab badge counts
  totalCountUnpurchased?: number;
  totalCountPurchased?: number;
  onItemPress: (id: string) => void;
  onItemEdit?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  onTogglePurchase?: (id: string) => void;
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
  // Pagination props for shopping tab
  onEndReachedUnpurchased?: () => void;
  hasMoreUnpurchased?: boolean;
  isLoadingMoreUnpurchased?: boolean;
  // Pagination props for purchased tab
  onEndReachedPurchased?: () => void;
  hasMorePurchased?: boolean;
  isLoadingMorePurchased?: boolean;
  // Permission flags for conditional rendering of item actions
  canAddItems?: boolean;
  canRemoveItems?: boolean;
  canEditItems?: boolean;
  canMarkPurchased?: boolean;
  canReorderItems?: boolean;
  // Transition state for showing skeletons during list switches
  isTransitioning?: boolean;
  // Batch move purchased items to pantry
  onBatchMoveToPantry?: () => void;
  batchMoveToPantryLoading?: boolean;
  // List header (e.g. SearchBar) rendered inside FlashList for correct RefreshControl position
  listHeaderComponent?: React.ReactElement | null;
  // Current search query for search-aware empty states in tabs
  searchQuery?: string;
  // Collapsible scroll handlers — threaded to FlashList via data context
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
  onItemEdit,
  onItemDelete,
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
  // Pagination props
  onEndReachedUnpurchased,
  hasMoreUnpurchased,
  isLoadingMoreUnpurchased,
  onEndReachedPurchased,
  hasMorePurchased,
  isLoadingMorePurchased,
  // Permission props - default to true for backward compatibility
  canRemoveItems = true,
  canEditItems = true,
  canMarkPurchased = true,
  canReorderItems = false,
  // Transition state
  isTransitioning = false,
  // Batch move to pantry
  onBatchMoveToPantry,
  batchMoveToPantryLoading = false,
  // Search query
  searchQuery,
  // Scroll direction tracking
  onScroll,
  onScrollBeginDrag,
  onScrollEndDrag,
  onMomentumScrollEnd,
  scrollEventThrottle,
  // Scrollable header content
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

  // TabView navigation state
  const [index, setIndex] = useState(0);

  // PERFORMANCE: Use pre-filtered items when provided (stable references from useShoppingListScreen)
  // Fall back to internal filtering for backwards compatibility
  const unpurchasedItems =
    preFilteredUnpurchased ?? (items?.filter(item => !item.isPurchased) || []);

  const purchasedItems =
    preFilteredPurchased ?? (items?.filter(item => item.isPurchased) || []);

  // Use GraphQL totalCount for accurate counts (handles pagination)
  // Fall back to array length for backwards compatibility
  const unpurchasedCount = totalCountUnpurchased ?? unpurchasedItems.length;
  const purchasedCount = totalCountPurchased ?? purchasedItems.length;

  // Handle tab change - close any open swipeable via external coordinator
  const handleIndexChange = (newIndex: number) => {
    onCloseAllSwipeables?.();
    setIndex(newIndex);
    // Notify tutorial when user switches to Purchased tab
    if (newIndex === 1) {
      tutorial?.notifyPurchasedTabTapped();
    }
  };

  // Auto-switch to purchased tab when tutorial advances to move-to-pantry step.
  // Uses the "adjusting state during render" pattern to avoid setState-in-effect.
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

  // Determine if we need to measure the purchased tab for tutorial spotlight
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

  // Action callbacks for context provider — consumed by ShoppingTab/PurchasedTab
  const tabActions: ShoppingListTabsActions = {
    onItemPress,
    onItemEdit,
    onItemDelete,
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
      { text: 'Cancel', style: 'cancel' },
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
      'Clear All Purchased Items',
      `Are you sure you want to remove ${
        count === 1 ? '1 purchased item' : `all ${count} purchased items`
      } from this list?`,
      'Clear All',
      () => {
        onClearAllPurchased?.();
      },
    );
  };

  const handleBatchMoveToPantryWithConfirmation = () => {
    if (purchasedItems.length === 0 || !onBatchMoveToPantry) return;
    const count = purchasedItems.length;
    confirmAction(
      'Move All to Pantry',
      `Move ${
        count === 1 ? '1 purchased item' : `all ${count} purchased items`
      } to your pantry?`,
      'Move All',
      onBatchMoveToPantry,
      false,
    );
  };

  const handleClearAllShoppingWithConfirmation = () => {
    if (unpurchasedItems.length === 0) return;
    const count = unpurchasedItems.length;
    confirmAction(
      'Clear All Shopping Items',
      `Are you sure you want to remove ${
        count === 1 ? '1 item' : `all ${count} items`
      } from your shopping list?`,
      'Clear All',
      () => {
        onClearAllShopping?.();
      },
    );
  };

  // Get the current clear handler based on active tab (by index)
  const currentClearHandler =
    index === 0
      ? handleClearAllShoppingWithConfirmation
      : handleClearAllWithConfirmation;

  // Get current items count for the active tab
  const currentItems = index === 0 ? unpurchasedItems : purchasedItems;
  const showClear = canRemoveItems && currentItems.length > 0;

  // Tab badge counts
  const counts = {
    shopping: unpurchasedCount,
    purchased: purchasedCount,
  };

  // Standalone jumpTo for FilterTabBar inside ListHeaderComponent
  const jumpTo = (key: string) => {
    const routeIndex = ROUTE_KEYS.indexOf(key as ShoppingListTabId);
    if (routeIndex >= 0) handleIndexChange(routeIndex);
  };

  // Build action buttons array: pantry icon (purchased tab only) + clear
  const actionButtons: FilterTabActionButton[] = [];

  // Show pantry move icon on purchased tab when there are items and handler exists
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
      label: 'Clear',
      onPress: currentClearHandler,
      testID: 'shopping-list-clear-all',
    });
  }

  // Render FilterTabBar as the TabView's tab bar so it's always visible,
  // even when a tab's FlashList is replaced by an empty state
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

  // Per-tab data for context — decoupled from renderScene so TabView doesn't
  // re-call renderScene on data changes (which would destroy FlashList recycling pools)
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
    onScroll,
    onScrollBeginDrag,
    onScrollEndDrag,
    onMomentumScrollEnd,
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
    onScroll,
    onScrollBeginDrag,
    onScrollEndDrag,
    onMomentumScrollEnd,
    scrollEventThrottle,
    listHeaderComponent,
  };

  const tabData = {
    shopping: shoppingTabData,
    purchased: purchasedTabData,
    searchQuery: searchQuery ?? '',
  };

  // Empty state: shown after loading completes with zero items across both tabs.
  // During transitions (list switches), items may briefly be empty — skip empty state.
  // When search is active, let per-tab empty states handle messaging instead.
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
    </ShoppingListTabsActionsProvider>
  );
};

export { ShoppingListTabs };
