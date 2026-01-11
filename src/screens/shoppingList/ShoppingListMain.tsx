import React, {
  useMemo,
  useEffect,
  useCallback,
  useRef,
  useState,
} from 'react';

// PERFORMANCE: Stable array for optimistic data restoration
// Prevents infinite loop from effect re-running due to new array reference
const OPTIMISTIC_ENTITY_TYPES: string[] = ['ShoppingList', 'ShoppingListItem'];
import { Alert, View, Pressable } from 'react-native';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { PaginationFooter } from '#/components/organisms/PaginationFooter';
import { useAppNavigation, useProfileData } from '#hooks';
import { StyleSheet } from 'react-native-unistyles';
import { AnimatedItemSelector, ListTemplate } from '#components';
import { Icon } from '#utils';
import { ShoppingListHeader } from '#/components/molecules/ShoppingListHeader';
import { useOptimisticDataRestorationMultiple } from '#/hooks/offline/useOptimisticDataRestoration';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { useFeatureHint } from '#/hooks/useFeatureHint';
import { SwipeHintOverlay } from '#/components/organisms/SwipeHintOverlay';
import { ShoppingListErrorBoundary } from '#/components/providers/ScreenErrorBoundary';
import { useScreenTransition } from '#hooks/performance';
import { Telemetry } from '#/services/telemetry';
import { ShoppingListTabs } from '#/components/organisms/ShoppingListTabs';
import { useTabBarActions } from '#context';
import { useUnistyles } from 'react-native-unistyles';
import { MoveToPantryModal } from '#/components/modals/MoveToPantryModal';
import { AddToShoppingListSheet } from '#/components/modals/AddToShoppingListSheet';
import { QuantityEditSheet } from '#/components/modals/QuantityEditSheet';
import {
  useUpdateShoppingListItemQuantityMutation,
  ShoppingListItemDisplayFragment,
} from '#generated';
import { useStore } from '#store';
import { useLazyHomeData } from '#hooks/home/useLazyHomeData';
import { getShoppingListPermissionsWithOwner } from '#/utils/permissions/shoppingListPermissions';
import { useAuth } from '#/hooks/auth/useAuth';

// Extracted hooks
import { useShoppingListScreen } from '#/hooks/shoppingList/useShoppingListScreen';
import { useShoppingListActions } from '#/hooks/shoppingList/useShoppingListActions';
import { useShoppingListSelectorModal } from '#/hooks/shoppingList/useShoppingListSelectorModal';
import {
  useMoveToPantry,
  type MoveToPantryInput,
} from '#/hooks/shoppingList/useMoveToPantry';
import { useItemReordering } from '#/hooks/shoppingList/useItemReordering';

/**
 * Shopping List Main Screen
 * Refactored to use extracted hooks for better separation of concerns
 *
 * Hook composition:
 * - useShoppingListScreen: Data orchestration (lists, items, sortableItems)
 * - useShoppingListActions: Mutation handlers (add, edit, delete, sort)
 * - useShoppingListSelectorModal: List selector modal logic
 */
const ShoppingListMainScreen: React.FC = React.memo(() => {
  // Restore optimistic data on mount (offline changes that haven't synced)
  useOptimisticDataRestorationMultiple(OPTIMISTIC_ENTITY_TYPES);

  // Feature hint for swipe gesture (shows once, after items load)
  const swipeHint = useFeatureHint({
    featureId: 'shopping_list_swipe',
    showOnMount: false,
  });

  const { navigate, navigateTo, isFocused } = useAppNavigation();
  const { setScannerProps, setAddProps } = useTabBarActions();
  const {
    theme: { colors },
  } = useUnistyles();

  // Get profile data for header
  const { profile } = useProfileData();
  const unreadCount = useStore(state => state.unreadCount);

  // Get current user for permission calculations
  const { user } = useAuth();

  // Track screen performance
  useScreenTransition('ShoppingListMain');

  // --- Screen Data Hook ---
  const {
    lists,
    listDataWithOwnership,
    currentList,
    currentListDetails, // Full details from GetShoppingList (for permissions)
    currentListId,
    items,
    sortableItems,
    unpurchasedItems,
    purchasedItems,
    loading,
    isLoadingInitial,
    searchQuery,
    setSearchQuery,
    addItem,
    toggleItem,
    removeItem,
    refetch: refetchItems,
    // Total counts for tab headers (from GraphQL, not array length)
    totalCountUnpurchased,
    totalCountPurchased,
    // Pagination - Shopping tab (unpurchased)
    loadMoreUnpurchased,
    hasMoreUnpurchased,
    isLoadingMoreUnpurchased,
    // Pagination - Purchased tab
    loadMorePurchased,
    hasMorePurchased,
    isLoadingMorePurchased,
    setSelectedShoppingListId,
  } = useShoppingListScreen();

  // --- Actions Hook ---
  const {
    handleTogglePurchase,
    handleDeleteItem,
    handleClearAllPurchased,
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
    items: unpurchasedItems, // Only unpurchased items can be reordered
    refetch: refetchItems,
  });

  // Wrapper to match the simpler callback signature used by the list component
  const handleSortOrderUpdate = useCallback(
    (itemId: string, afterItemId: string | null, beforeItemId: string | null) => {
      // The hook expects sortOrder values too, but calculates them internally now
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

  // PERFORMANCE: Store items in ref to avoid recreating callbacks on every items change
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Add to shopping list sheet state
  const [addSheetVisible, setAddSheetVisible] = useState(false);

  // Move to pantry modal state
  const [moveToPantryModalVisible, setMoveToPantryModalVisible] =
    useState(false);
  const [selectedItemForMove, setSelectedItemForMove] =
    useState<ShoppingListItemDisplayFragment | null>(null);

  // Quantity edit sheet state
  const [quantitySheetVisible, setQuantitySheetVisible] = useState(false);
  const [selectedItemForQuantity, setSelectedItemForQuantity] =
    useState<ShoppingListItemDisplayFragment | null>(null);
  const [quantityUpdateLoading, setQuantityUpdateLoading] = useState(false);

  // Update shopping list item quantity mutation (syncs both quantity and quantityInput)
  const [updateShoppingListItemQuantity] =
    useUpdateShoppingListItemQuantityMutation({
      errorPolicy: 'all',
      onError: error => {
        Alert.alert('Error', error.message || 'Failed to update item');
      },
    });

  // Get home and pantries for moving items (lazy loaded on demand)
  const {
    pantries,
    selectedPantryId,
    isLoaded: homeDataLoaded,
    fetchHomeData,
  } = useLazyHomeData();

  // Move to pantry hook
  const { moveToPantry } = useMoveToPantry({
    currentListId,
    onSuccess: () => {
      setMoveToPantryModalVisible(false);
      setSelectedItemForMove(null);
    },
  });

  // Handle move to pantry button press
  const handleMoveToPantry = useCallback(
    async (itemId: string) => {
      // Fetch home data if not already loaded (lazy load on demand)
      if (!homeDataLoaded) {
        await fetchHomeData();
      }

      // Check pantries after data is loaded
      // Note: pantries will be populated after fetchHomeData completes and component re-renders
      // We check pantries.length here but the actual check happens after the async fetch
      if (pantries.length === 0 && homeDataLoaded) {
        Alert.alert(
          'No Pantry Available',
          'Please create a pantry in your home first.',
          [{ text: 'OK' }],
        );
        return;
      }

      const item = itemsRef.current.find((i: any) => i.id === itemId);
      if (item) {
        setSelectedItemForMove(item as ShoppingListItemDisplayFragment);
        setMoveToPantryModalVisible(true);
      }
    },
    [homeDataLoaded, fetchHomeData, pantries.length],
  );

  // Handle confirm move to pantry
  const handleConfirmMoveToPantry = useCallback(
    async (input: MoveToPantryInput) => {
      if (!selectedItemForMove) return;
      await moveToPantry(selectedItemForMove, input);
    },
    [selectedItemForMove, moveToPantry],
  );

  // Handle close move to pantry modal
  const handleCloseMoveToPantryModal = useCallback(() => {
    setMoveToPantryModalVisible(false);
    setSelectedItemForMove(null);
  }, []);

  // Handle quantity press - open quantity edit sheet
  const handleQuantityPress = useCallback((itemId: string) => {
    const item = itemsRef.current.find((i: any) => i.id === itemId);
    if (item) {
      setSelectedItemForQuantity(item as ShoppingListItemDisplayFragment);
      setQuantitySheetVisible(true);
    }
  }, []);

  // Handle quantity save - update item with new quantity and/or unit
  const handleQuantitySave = useCallback(
    async (
      quantity: string,
      _unitName: string | null,
      unitId: string | null,
    ) => {
      if (!selectedItemForQuantity) return;

      setQuantityUpdateLoading(true);
      try {
        await updateShoppingListItemQuantity({
          variables: {
            itemId: selectedItemForQuantity.id,
            quantity,
            // null clears unit, undefined keeps current, string updates to new unit
            unitId,
            version: selectedItemForQuantity.version,
          },
        });

        Telemetry.trackEvent('shopping_item_quantity_updated', {
          item_id: selectedItemForQuantity.id,
          quantity,
        });

        setQuantitySheetVisible(false);
        setSelectedItemForQuantity(null);
      } catch (error) {
        // Error handled by mutation onError
      } finally {
        setQuantityUpdateLoading(false);
      }
    },
    [selectedItemForQuantity, updateShoppingListItemQuantity],
  );

  // Handle close quantity edit sheet
  const handleCloseQuantitySheet = useCallback(() => {
    setQuantitySheetVisible(false);
    setSelectedItemForQuantity(null);
  }, []);

  // Track currently open swipeable across both unpurchased and purchased lists
  const openSwipeableRef =
    useRef<React.RefObject<SwipeableMethods | null> | null>(null);

  // Show swipe hint after items load (only once, only if there are unpurchased items)
  // PERFORMANCE: Only depend on items.length to avoid re-running on every items change
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
  }, [items.length, swipeHint]);

  // Handle add item - open sheet
  const handleAddItem = useCallback(() => {
    if (!currentListId) {
      Telemetry.trackEvent('add_item_no_list_selected');
      Alert.alert(
        'No List Selected',
        'Please select or create a shopping list first.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Create List',
            onPress: () => {
              Telemetry.trackEvent('create_list_from_add_item');
              navigate('ListSettings');
            },
          },
        ],
      );
      return;
    }
    Telemetry.trackEvent('add_item_clicked', { list_id: currentListId });
    setAddSheetVisible(true);
  }, [currentListId, navigate]);

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

  // Handle swipeable coordination
  const handleSwipeableWillOpen = useCallback(
    (ref: React.RefObject<SwipeableMethods | null>) => {
      if (openSwipeableRef.current && openSwipeableRef.current !== ref) {
        openSwipeableRef.current.current?.close();
      }
      openSwipeableRef.current = ref;
    },
    [],
  );

  const handleSwipeableClose = useCallback(() => {
    openSwipeableRef.current = null;
  }, []);

  // Calculate permissions for the current list
  // - Home-linked lists use home membership permissions
  // - Personal lists use collaborator permissions
  // - Owners always have full permissions
  // Uses currentListDetails from GetShoppingList query (has full data for permissions)
  const permissions = useMemo(() => {
    if (!currentListDetails) {
      return {
        canAddItems: true,
        canRemoveItems: true,
        canEditItems: true,
        canMarkPurchased: true,
      };
    }

    // Build the shopping list data shape for permission calculation
    const listData = {
      homeId: currentListDetails.homeId,
      collaboratorsConnection: currentListDetails.collaboratorsConnection,
      ownership: currentListDetails.ownerships?.[0],
    };

    // Get home membership if list is linked to a home
    const homeMembership = currentListDetails.home?.myMembership ?? null;

    return getShoppingListPermissionsWithOwner(
      listData,
      user?.id,
      homeMembership,
    );
  }, [currentListDetails, user?.id]);

  // Search bar actions - icons inside the input (matching pantry style)
  const searchBarActions = useMemo(
    () => ({
      showSearchIcon: true,
      innerRightIcon:
        searchQuery.trim().length === 0 ? (
          <Pressable
            onPress={handleOpenSelector}
            hitSlop={8}
            testID="shopping-list-selector"
          >
            <Icon
              name="list"
              size={18}
              color={colors.textTertiary}
              library="Ionicons"
            />
          </Pressable>
        ) : undefined,
    }),
    [handleOpenSelector, searchQuery, colors],
  );

  // PERFORMANCE: Memoize customListProps to prevent ShoppingListTabs re-renders
  // Pre-filtered items have stable references from useShoppingListScreen
  const customListProps = useMemo(
    () => ({
      loading: isLoadingInitial,
      onTogglePurchase: handleTogglePurchase,
      onMoveToPantry: handleMoveToPantry,
      onQuantityPress: handleQuantityPress,
      onSortOrderUpdate: handleSortOrderUpdate,
      onRefresh: handleRefresh,
      refreshing,
      disabled: !!searchQuery.trim(),
      onClearAllPurchased: handleClearAllPurchased,
      onSwipeableWillOpen: handleSwipeableWillOpen,
      onSwipeableClose: handleSwipeableClose,
      // Pre-filtered items with stable references (no filtering needed in ShoppingListTabs)
      unpurchasedItems,
      purchasedItems,
      // Total counts for tab headers (from GraphQL totalCount, not array length)
      totalCountUnpurchased,
      totalCountPurchased,
      // Pagination props for shopping tab (unpurchased)
      onEndReachedUnpurchased: loadMoreUnpurchased,
      hasMoreUnpurchased,
      isLoadingMoreUnpurchased,
      // Pagination props for purchased tab
      onEndReachedPurchased: loadMorePurchased,
      hasMorePurchased,
      isLoadingMorePurchased,
      // Permission flags for conditional rendering of item actions
      canAddItems: permissions.canAddItems,
      canRemoveItems: permissions.canRemoveItems,
      canEditItems: permissions.canEditItems,
      canMarkPurchased: permissions.canMarkPurchased,
      // Enable reordering for users with edit permissions
      canReorderItems: permissions.canEditItems,
    }),
    [
      isLoadingInitial,
      searchQuery,
      handleTogglePurchase,
      handleMoveToPantry,
      handleQuantityPress,
      handleSortOrderUpdate,
      handleRefresh,
      refreshing,
      handleClearAllPurchased,
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
    ],
  );

  // Use ref to track currentListId for scanner
  const currentListIdRef = useRef(currentListId);
  useEffect(() => {
    currentListIdRef.current = currentListId;
  }, [currentListId]);

  // Set up scanner and telemetry
  // PERFORMANCE: Debounce telemetry to prevent tracking on every mutation
  useEffect(() => {
    const telemetryTimer = setTimeout(() => {
      Telemetry.trackScreen('ShoppingListMain', {
        list_id: currentListId,
        item_count: itemsRef.current.length,
        purchased_count: itemsRef.current.filter(item => item.purchaseInfo?.isPurchased)
          .length,
        has_lists: lists.length > 0,
      });
    }, 500); // Debounce 500ms to batch rapid changes

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
  }, [setScannerProps, navigateTo, currentListId, items.length, lists.length]);

  // Register add button action - open add to shopping list sheet
  useEffect(() => {
    if (isFocused) {
      setAddProps(() => {
        Telemetry.trackEvent('add_item_from_tab_bar', {
          list_id: currentListId,
        });
        setAddSheetVisible(true);
      }, true);
    }
    return () => {
      setAddProps(undefined, false);
    };
  }, [isFocused, setAddProps, currentListId]);

  // Combined pagination state for footer display
  const hasMore = hasMoreUnpurchased || hasMorePurchased;
  const isLoadingMore = isLoadingMoreUnpurchased || isLoadingMorePurchased;

  // Memoized footer
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
      <View style={styles.container}>
        <ShoppingListHeader
          listName="Shopping List"
          avatarUrl={profile?.avatar}
          notificationCount={unreadCount}
          onAvatarPress={() => navigateTo.notificationList()}
        />
        <ListTemplate
          items={[]}
          showUserHeader={false}
          showSearchBar={false}
          emptyState={noListsEmptyState}
          hasNoData={true}
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
      onPress: handleAddItem,
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
      <ListTemplate
        items={sortableItems}
        loading={isLoadingInitial}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onItemPress={id =>
          navigate('ItemDetail', { listId: currentListId, itemId: id })
        }
        onItemEdit={id =>
          navigate('EditItem', { listId: currentListId, itemId: id })
        }
        onItemDelete={handleDeleteItem}
        onRefresh={handleRefresh}
        searchPlaceholder="Search shopping list..."
        listName={currentList?.name || 'Shopping List'}
        completedCount={sortableItems.filter(item => item.isPurchased).length}
        showUserHeader={false}
        showSearchBar={true}
        searchBarActions={searchBarActions}
        testIDPrefix="shopping-list-item"
        emptyState={emptyStateConfig}
        customListComponent={ShoppingListTabs}
        customListProps={customListProps}
        ListFooterComponent={footerComponent}
      />

      <AnimatedItemSelector
        ref={selectorRef}
        config={listConfig}
        maxHeight={600}
        onOpen={handleOverlayOpen}
        onClose={handleOverlayClose}
      />

      {/* Swipe gesture hint overlay */}
      {swipeHint.isVisible && (
        <SwipeHintOverlay onDismiss={swipeHint.dismiss} />
      )}

      {/* Move to Pantry Modal */}
      <MoveToPantryModal
        visible={moveToPantryModalVisible}
        shoppingListItem={selectedItemForMove}
        pantries={pantries}
        selectedPantryId={selectedPantryId}
        onClose={handleCloseMoveToPantryModal}
        onConfirm={handleConfirmMoveToPantry}
      />

      {/* Add to Shopping List Sheet */}
      <AddToShoppingListSheet
        visible={addSheetVisible}
        shoppingListId={currentListId}
        onClose={() => setAddSheetVisible(false)}
        initialSearchQuery={searchQuery}
        onItemAdded={() => setSearchQuery('')}
      />

      {/* Quantity Edit Sheet */}
      <QuantityEditSheet
        visible={quantitySheetVisible}
        item={
          selectedItemForQuantity
            ? {
                id: selectedItemForQuantity.id,
                itemName: selectedItemForQuantity.itemName || 'Item',
                quantity: selectedItemForQuantity.quantity ?? 0,
                unitName:
                  selectedItemForQuantity.unit?.symbol ||
                  selectedItemForQuantity.unitName ||
                  null,
                unitId: selectedItemForQuantity.unit?.id || null,
                category: selectedItemForQuantity.category || null,
                version: selectedItemForQuantity.version,
                itemUnits:
                  selectedItemForQuantity.item?.units
                    ?.map(iu => ({
                      id: iu.unit?.id || iu.id,
                      symbol: iu.unit?.symbol || '',
                      name: iu.unit?.name || '',
                      isDefault: iu.isDefault,
                      isPreferred: iu.isPreferred,
                      // Item-specific display names for better UX
                      displayNameSingular: iu.displayNameSingular,
                      displayNamePlural: iu.displayNamePlural,
                    }))
                    .filter(
                      u =>
                        u.symbol &&
                        u.symbol.toLowerCase() !== 'undetermined',
                    ) || [],
              }
            : null
        }
        onClose={handleCloseQuantitySheet}
        onSave={handleQuantitySave}
        loading={quantityUpdateLoading}
      />
    </View>
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
