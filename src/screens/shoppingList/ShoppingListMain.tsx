import React, {
  useMemo,
  useEffect,
  useCallback,
  useRef,
  useState,
} from 'react';
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
  BasicPantryFragment,
} from '#generated';
import { useAppStore, selectSelectedPantryId } from '#store/useAppStore';
import { useStore } from '#store';
import { useDefaultHome } from '#hooks/home/useDefaultHome';
import { normalizeHome } from '#/utils/connectionUtils';

// Extracted hooks
import { useShoppingListScreen } from '#/hooks/shoppingList/useShoppingListScreen';
import { useShoppingListActions } from '#/hooks/shoppingList/useShoppingListActions';
import { useShoppingListSelectorModal } from '#/hooks/shoppingList/useShoppingListSelectorModal';
import {
  useMoveToPantry,
  type MoveToPantryInput,
} from '#/hooks/shoppingList/useMoveToPantry';

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
  useOptimisticDataRestorationMultiple(['ShoppingList', 'ShoppingListItem']);

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

  // Track screen performance
  useScreenTransition('ShoppingListMain');

  // --- Screen Data Hook ---
  const {
    lists,
    listDataWithOwnership,
    currentList,
    currentListId,
    items,
    sortableItems,
    loading,
    isLoadingInitial,
    searchQuery,
    setSearchQuery,
    addItem,
    toggleItem,
    removeItem,
    refetch: refetchItems,
    loadMore,
    hasMore,
    isLoadingMore,
    setSelectedShoppingListId,
  } = useShoppingListScreen();

  // --- Actions Hook ---
  const {
    handleSortOrderUpdate,
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

  // Get home and pantries for moving items
  const selectedPantryId = useAppStore(selectSelectedPantryId);
  const { selectedHomeId, homes } = useDefaultHome();

  // Get pantries for the current home
  const pantries = useMemo(() => {
    if (!selectedHomeId || !homes.length) return [];
    const currentHome = homes.find(h => h.id === selectedHomeId);
    if (!currentHome) return [];
    const normalized = normalizeHome(currentHome);
    return (normalized?.pantries || []) as BasicPantryFragment[];
  }, [selectedHomeId, homes]);

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
    (itemId: string) => {
      if (pantries.length === 0) {
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
    [pantries.length],
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
      quantity: number,
      _unitName: string | null,
      unitId: string | null,
    ) => {
      if (!selectedItemForQuantity) return;

      setQuantityUpdateLoading(true);
      try {
        await updateShoppingListItemQuantity({
          variables: {
            itemId: selectedItemForQuantity.id,
            quantity: quantity.toString(),
            unitId: unitId || undefined,
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
      const unpurchasedItems = itemsRef.current.filter(
        (item: any) => !item.purchaseInfo?.isPurchased,
      );
      if (unpurchasedItems.length > 0) {
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
  const customListProps = useMemo(
    () => ({
      loading: isLoadingInitial,
      onSortOrderUpdate: searchQuery.trim() ? undefined : handleSortOrderUpdate,
      onTogglePurchase: handleTogglePurchase,
      onMoveToPantry: handleMoveToPantry,
      onQuantityPress: handleQuantityPress,
      onRefresh: handleRefresh,
      refreshing,
      disabled: !!searchQuery.trim(),
      onClearAllPurchased: handleClearAllPurchased,
      onSwipeableWillOpen: handleSwipeableWillOpen,
      onSwipeableClose: handleSwipeableClose,
    }),
    [
      isLoadingInitial,
      searchQuery,
      handleSortOrderUpdate,
      handleTogglePurchase,
      handleMoveToPantry,
      handleQuantityPress,
      handleRefresh,
      refreshing,
      handleClearAllPurchased,
      handleSwipeableWillOpen,
      handleSwipeableClose,
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
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
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
                    }))
                    .filter(u => u.symbol) || [],
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
