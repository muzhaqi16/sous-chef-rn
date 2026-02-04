import React, {
  useMemo,
  useEffect,
  useCallback,
  useState,
} from 'react';
import { View, Pressable } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

// Components
import { AnimatedItemSelector } from '#components/organisms/AnimatedItemSelector/AnimatedItemSelector';
import { ListTemplate } from '#components/templates/ListTemplate';
import { ShoppingListHeader } from '#components/molecules/ShoppingListHeader';
import { SearchBar } from '#components/molecules/SearchBar';
import { ShoppingListTabs } from '#components/organisms/ShoppingListTabs/ShoppingListTabs';
import { PaginationFooter } from '#components/organisms/PaginationFooter';
import { SwipeHintOverlay } from '#components/organisms/SwipeHintOverlay';
import { Icon } from '#utils/iconUtils';
import { ShoppingListErrorBoundary } from '#/components/providers/ScreenErrorBoundary';

// Hooks & Context
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useTabBarAddButton } from '#hooks/navigation/useTabBarAddButton';
import { useProfileData } from '#hooks/profile/useProfileData';
import { useFeatureHint } from '#hooks/useFeatureHint';
import { useShoppingListScreen } from '#hooks/shoppingList/useShoppingListScreen';
import { useShoppingListActions } from '#hooks/shoppingList/useShoppingListActions';
import { useShoppingListSelectorModal } from '#hooks/shoppingList/useShoppingListSelectorModal';
import { useItemReordering } from '#hooks/shoppingList/useItemReordering';
import { useSwipeableCoordinator } from '#hooks/ui/useSwipeableCoordinator';
import { useTabBarActions } from '#/context/TabBarActionsContext';
import { ShoppingListModalsProvider, useShoppingListModals } from '#/context/ShoppingListModalsContext';
import { useStore } from '#store';
import { useAuth } from '#/hooks/auth/useAuth';
import { useStableRef } from '#/hooks/utils/useStableRef';
import { useOptimisticDataRestorationMultiple } from '#/hooks/offline/useOptimisticDataRestoration';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';

// Utils
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { Telemetry } from '#/services/telemetry';
import { getShoppingListPermissionsWithOwner } from '#/utils/permissions/shoppingListPermissions';

/**
 * Inner content component that uses modal context.
 * Separated to allow useShoppingListModals() to access the provider.
 */
interface ShoppingListMainContentProps {
  screenData: ReturnType<typeof useShoppingListScreen>;
}

const ShoppingListMainContent: React.FC<ShoppingListMainContentProps> =
  React.memo(({ screenData }) => {
    const {
      lists,
      listDataWithOwnership,
      currentList,
      currentListDetails,
      currentListId,
      items,
      sortableItems,
      unpurchasedItems,
      purchasedItems,
      rawUnpurchasedItems,
      loading,
      isLoadingInitial,
      searchQuery,
      setSearchQuery,
      addItem,
      toggleItem,
      removeItem,
      refetch: refetchItems,
      totalCountUnpurchased,
      totalCountPurchased,
      loadMoreUnpurchased,
      hasMoreUnpurchased,
      isLoadingMoreUnpurchased,
      loadMorePurchased,
      hasMorePurchased,
      isLoadingMorePurchased,
      setSelectedShoppingListId,
    } = screenData;

    // Get modal actions from context (provided by ShoppingListModalsProvider)
    const { addItemSheet, quantityEdit, moveToPantry } =
      useShoppingListModals();

    // Feature hint for swipe gesture (shows once, after items load)
    const swipeHint = useFeatureHint({
      featureId: 'shopping_list_swipe',
      showOnMount: false,
    });

    const { navigate, navigateTo } = useAppNavigation();
    const { setScannerProps } = useTabBarActions();
    const { theme } = useUnistyles();

    // Get profile data for header
    const { profile } = useProfileData();
    const unreadCount = useStore(state => state.unreadCount);

    // Get current user for permission calculations
    const { user } = useAuth();

    // Track screen performance
    useScreenTransition('ShoppingListMain');

    // --- Actions Hook ---
    const {
      handleTogglePurchase,
      handleDeleteItem,
      handleClearAllPurchased,
      handleClearAllShopping,
    } = useShoppingListActions({
      currentListId,
      items,
      addItem,
      toggleItem,
      removeItem,
      refetchItems,
      setSearchQuery,
    });

    // --- Reordering Hook ---
    const { handleSortOrderUpdate: reorderItem } = useItemReordering({
      listId: currentListId,
      items: rawUnpurchasedItems,
      refetch: refetchItems,
    });

    const handleSortOrderUpdate = useCallback(
      (
        itemId: string,
        afterItemId: string | null,
        beforeItemId: string | null,
      ) => {
        reorderItem(itemId, afterItemId, beforeItemId, null, null);
      },
      [reorderItem],
    );

    // --- Selector Hook ---
    const {
      selectorRef,
      listConfig,
      handleOpenSelector,
      handleOverlayOpen,
      handleOverlayClose,
    } = useShoppingListSelectorModal({
      listDataWithOwnership,
      currentListId,
      setSelectedShoppingListId,
    });

    // Local state
    const [refreshing, setRefreshing] = useState(false);

    // PERFORMANCE: Store items in stable ref to avoid recreating callbacks on every items change
    const itemsRef = useStableRef(items);

    // Stable ref to store addItemSheet.open to avoid dependency instability in useEffect
    const addItemSheetOpenRef = useStableRef(addItemSheet.open);

    // Coordinate swipeable items so only one is open at a time
    const { handleSwipeableWillOpen, handleSwipeableClose } = useSwipeableCoordinator();

    // Show swipe hint after items load
    useEffect(() => {
      if (items.length > 0 && !swipeHint.hasBeenShown) {
        const unpurchasedForHint = itemsRef.current.filter(
          (item: any) => !item.purchaseInfo?.isPurchased,
        );
        if (unpurchasedForHint.length > 0) {
          const timer = setTimeout(() => {
            swipeHint.show();
          }, 1500);
          return () => clearTimeout(timer);
        }
      }
    }, [items.length, swipeHint, itemsRef]);

    // Handle refresh
    const handleRefresh = useCallback(async () => {
      setRefreshing(true);
      try {
        optimisticDataPersistence.clearType('ShoppingListItem');
        await refetchItems();
      } finally {
        setRefreshing(false);
      }
    }, [refetchItems]);

    // Calculate permissions for the current list
    const permissions = useMemo(() => {
      if (!currentListDetails) {
        return {
          canAddItems: true,
          canRemoveItems: true,
          canEditItems: true,
          canMarkPurchased: true,
        };
      }

      const listData = {
        homeId: currentListDetails.homeId,
        collaboratorsConnection: currentListDetails.collaboratorsConnection,
        ownership: currentListDetails.ownerships?.[0],
      };

      const homeMembership = currentListDetails.home?.myMembership ?? null;

      return getShoppingListPermissionsWithOwner(
        listData,
        user?.id,
        homeMembership,
      );
    }, [currentListDetails, user?.id]);

    // Search bar inner right icon (list selector button)
    const searchBarInnerRightIcon = useMemo(
      () =>
        searchQuery.trim().length === 0 ? (
          <Pressable
            onPress={handleOpenSelector}
            hitSlop={8}
            testID="shopping-list-selector"
          >
            <Icon
              name="list"
              size={18}
              color={theme.colors.textTertiary}
              library="Ionicons"
            />
          </Pressable>
        ) : undefined,
      [handleOpenSelector, searchQuery, theme.colors.textTertiary],
    );

    // Memoized customListProps
    const customListProps = useMemo(
      () => ({
        loading: isLoadingInitial,
        onTogglePurchase: handleTogglePurchase,
        onMoveToPantry: moveToPantry.openForItem,
        onQuantityPress: quantityEdit.openForItem,
        onSortOrderUpdate: handleSortOrderUpdate,
        onRefresh: handleRefresh,
        refreshing,
        disabled: !!searchQuery.trim(),
        onClearAllPurchased: handleClearAllPurchased,
        onClearAllShopping: handleClearAllShopping,
        onSwipeableWillOpen: handleSwipeableWillOpen,
        onSwipeableClose: handleSwipeableClose,
        unpurchasedItems,
        purchasedItems,
        totalCountUnpurchased,
        totalCountPurchased,
        onEndReachedUnpurchased: loadMoreUnpurchased,
        hasMoreUnpurchased,
        isLoadingMoreUnpurchased,
        onEndReachedPurchased: loadMorePurchased,
        hasMorePurchased,
        isLoadingMorePurchased,
        canAddItems: permissions.canAddItems,
        canRemoveItems: permissions.canRemoveItems,
        canEditItems: permissions.canEditItems,
        canMarkPurchased: permissions.canMarkPurchased,
        canReorderItems: permissions.canEditItems,
        onAddItem: addItemSheet.open,
      }),
      [
        isLoadingInitial,
        searchQuery,
        handleTogglePurchase,
        moveToPantry.openForItem,
        quantityEdit.openForItem,
        handleSortOrderUpdate,
        handleRefresh,
        refreshing,
        handleClearAllPurchased,
        handleClearAllShopping,
        handleSwipeableWillOpen,
        handleSwipeableClose,
        unpurchasedItems,
        purchasedItems,
        totalCountUnpurchased,
        totalCountPurchased,
        loadMoreUnpurchased,
        hasMoreUnpurchased,
        isLoadingMoreUnpurchased,
        loadMorePurchased,
        hasMorePurchased,
        isLoadingMorePurchased,
        permissions,
        addItemSheet.open,
      ],
    );

    // Use stable ref to track currentListId for scanner
    const currentListIdRef = useStableRef(currentListId);

    // Set up scanner and telemetry
    useEffect(() => {
      const telemetryTimer = setTimeout(() => {
        Telemetry.trackScreen('ShoppingListMain', {
          list_id: currentListId,
          item_count: itemsRef.current.length,
          purchased_count: itemsRef.current.filter(
            item => item.purchaseInfo?.isPurchased,
          ).length,
          has_lists: lists.length > 0,
        });
      }, 500);

      const handleScanPress = () => {
        Telemetry.trackEvent('barcode_scanner_opened', {
          source: 'shopping_list',
          list_id: currentListIdRef.current,
        });
        navigateTo.barcode({
          source: 'shoppingList',
          shoppingListId: currentListIdRef.current,
        });
      };

      setScannerProps(handleScanPress, true);

      return () => {
        clearTimeout(telemetryTimer);
        setScannerProps(undefined, false);
      };
    }, [
      setScannerProps,
      navigateTo,
      currentListId,
      items.length,
      lists.length,
      currentListIdRef,
      itemsRef,
    ]);

    // Register add button action
    // Button visibility is automatic on allowed tabs; we just register handler and disabled state
    useTabBarAddButton(
      () => {
        Telemetry.trackEvent('add_item_from_tab_bar', {
          list_id: currentListId,
        });
        addItemSheetOpenRef.current();
      },
      !permissions.canAddItems,
      permissions.canAddItems
        ? undefined
        : "You don't have permission to add items to this list",
    );

    // Combined pagination state for footer
    const hasMore = hasMoreUnpurchased || hasMorePurchased;
    const isLoadingMore = isLoadingMoreUnpurchased || isLoadingMorePurchased;

    const footerComponent = useMemo(
      () => (
        <PaginationFooter
          isLoadingMore={isLoadingMore}
          hasMore={hasMore}
          loading={loading}
          itemCount={items.length}
        />
      ),
      [isLoadingMore, hasMore, loading, items.length],
    );

    // Empty state when no lists exist
    if (lists.length === 0) {
      const noListsEmptyState = {
        icon: 'add-shopping-cart' as const,
        title: 'No shopping lists',
        description: 'Create a shopping list to get started',
        action: {
          label: 'Create List',
          onPress: () => navigate('ListSettings'),
        },
      };

      return (
        <View style={styles.container} testID="shopping-list-screen">
          <ShoppingListHeader
            listName="Shopping List"
            avatarUrl={profile?.avatar}
            notificationCount={unreadCount}
            onAvatarPress={() => navigateTo.notificationList()}
          />
          <ListTemplate
            items={[]}
            emptyState={noListsEmptyState}
          />
        </View>
      );
    }

    const emptyStateConfig = {
      icon: 'add-shopping-cart' as const,
      title: 'No items in this list',
      description: 'Add some items to get started',
      action: {
        label: 'Add Item',
        onPress: addItemSheet.open,
      },
    };

    return (
      <View style={styles.container} testID="shopping-list-screen">
        <ShoppingListHeader
          listName={currentList?.name || 'Shopping List'}
          avatarUrl={profile?.avatar}
          notificationCount={unreadCount}
          onAvatarPress={() => navigateTo.notificationList()}
        />
        <View style={{ paddingHorizontal: theme.spacing.md }}>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search shopping list..."
            showSearchIcon
            innerRightIcon={searchBarInnerRightIcon}
          />
        </View>
        <ListTemplate
          items={sortableItems}
          loading={isLoadingInitial}
          onItemPress={id =>
            navigate('ItemDetail', { listId: currentListId, itemId: id })
          }
          onItemEdit={id =>
            navigate('EditItem', { listId: currentListId, itemId: id })
          }
          onItemDelete={handleDeleteItem}
          onRefresh={handleRefresh}
          testIDPrefix="shopping-list-item"
          emptyState={emptyStateConfig}
          customListComponent={ShoppingListTabs}
          customListProps={customListProps}
          ListFooterComponent={footerComponent}
        />

        <AnimatedItemSelector
          ref={selectorRef}
          config={listConfig}
          onOpen={handleOverlayOpen}
          onClose={handleOverlayClose}
        />

        {/* Swipe gesture hint overlay */}
        {swipeHint.isVisible && (
          <SwipeHintOverlay onDismiss={swipeHint.dismiss} />
        )}

        {/* Modals are rendered inside ShoppingListModalsProvider */}
      </View>
    );
  });

/**
 * Outer screen component that:
 * 1. Restores optimistic data
 * 2. Fetches screen data
 * 3. Wraps content with ShoppingListModalsProvider
 */
const ShoppingListMainScreen: React.FC = React.memo(() => {
  // Restore optimistic data on mount (offline changes that haven't synced)
  // Hook handles array stability internally - inline array is fine
  useOptimisticDataRestorationMultiple(['ShoppingList', 'ShoppingListItem']);

  const { navigate } = useAppNavigation();

  // --- Screen Data Hook ---
  const screenData = useShoppingListScreen();

  return (
    <ShoppingListModalsProvider
      currentListId={screenData.currentListId}
      items={screenData.items}
      searchQuery={screenData.searchQuery}
      onSearchQueryClear={() => screenData.setSearchQuery('')}
      onNavigateToListSettings={() => navigate('ListSettings')}
    >
      <ShoppingListMainContent screenData={screenData} />
    </ShoppingListModalsProvider>
  );
});

// Screen-level error boundary prevents full app reset on mutation failures
export const ShoppingListMain: React.FC = () => (
  <ShoppingListErrorBoundary>
    <ShoppingListMainScreen />
  </ShoppingListErrorBoundary>
);

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
}));
