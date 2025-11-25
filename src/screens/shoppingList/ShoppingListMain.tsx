import React, {
  useMemo,
  useEffect,
  useCallback,
  useRef,
  useState,
} from 'react';
import { Alert, View } from 'react-native';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { PaginationFooter } from '#/components/organisms/PaginationFooter';
import { useAppNavigation } from '#hooks';
import { StyleSheet } from 'react-native-unistyles';
import {
  SearchBarAction,
  AnimatedItemSelector,
  ListTemplate,
} from '#components';
import { useOptimisticDataRestorationMultiple } from '#/hooks/offline/useOptimisticDataRestoration';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { useFeatureHint } from '#/hooks/useFeatureHint';
import { SwipeHintOverlay } from '#/components/organisms/SwipeHintOverlay';
import { ShoppingListErrorBoundary } from '#/components/providers/ScreenErrorBoundary';
import { useScreenTransition } from '#hooks/performance';
import { Telemetry } from '#/services/telemetry';
import { ShoppingListTabs } from '#/components/organisms/ShoppingListTabs';
import { ShoppingListActionsProvider } from '#context/ShoppingListActionsContext';
import { useScanner } from '#context';
import { useUnistyles } from 'react-native-unistyles';

// Extracted hooks
import { useShoppingListScreen } from '#/hooks/shoppingList/useShoppingListScreen';
import { useShoppingListActions } from '#/hooks/shoppingList/useShoppingListActions';
import { useShoppingListSelectorModal } from '#/hooks/shoppingList/useShoppingListSelectorModal';

/**
 * Shopping List Main Screen
 * Refactored to use extracted hooks for better separation of concerns
 *
 * Hook composition:
 * - useShoppingListScreen: Data orchestration (lists, items, sortableItems)
 * - useShoppingListActions: Mutation handlers (add, edit, delete, sort)
 * - useShoppingListSelector: List selector modal logic
 */
const ShoppingListMainScreen: React.FC = React.memo(() => {
  // Restore optimistic data on mount (offline changes that haven't synced)
  useOptimisticDataRestorationMultiple(['ShoppingList', 'ShoppingListItem']);

  // Feature hint for swipe gesture (shows once, after items load)
  const swipeHint = useFeatureHint({
    featureId: 'shopping_list_swipe',
    showOnMount: false,
  });

  const { navigate, navigateTo } = useAppNavigation();
  const { setScannerProps } = useScanner();
  const {
    theme: { colors },
  } = useUnistyles();
  const { primary: primaryColor, primaryLight: primaryLightColor } = colors;

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
    handleIncrementQuantity,
    handleDecrementQuantity,
    handleTogglePurchase,
    handleDeleteItem,
    handleClearAllPurchased,
    handleAddItemFromSearch,
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

  // Track currently open swipeable across both unpurchased and purchased lists
  const openSwipeableRef =
    useRef<React.RefObject<SwipeableMethods | null> | null>(null);

  // Show swipe hint after items load (only once, only if there are unpurchased items)
  useEffect(() => {
    if (items.length > 0 && !swipeHint.hasBeenShown) {
      const unpurchasedItems = items.filter((item: any) => !item.isPurchased);
      if (unpurchasedItems.length > 0) {
        const timer = setTimeout(() => {
          swipeHint.show();
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [items, swipeHint]);

  // Handle add item navigation
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
    navigate('AddItem', { listId: currentListId });
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

  // Search bar actions
  const searchBarActions = useMemo(() => {
    const hasSearchWithNoResults =
      searchQuery.trim() && sortableItems.length === 0;
    const rightActions: SearchBarAction[] = [
      {
        icon: 'list',
        color: colors.white,
        onPress: handleOpenSelector,
      },
    ];

    if (hasSearchWithNoResults) {
      rightActions.unshift({
        icon: 'add',
        onPress: () => handleAddItemFromSearch(searchQuery),
        color: primaryColor,
        backgroundColor: primaryLightColor,
        animated: true,
        isHighlighted: true,
        testID: 'shopping-list-add-button',
      });
    } else {
      rightActions.unshift({
        icon: 'add',
        onPress: handleAddItem,
        color: primaryColor,
        backgroundColor: colors.surface,
        animated: true,
        isHighlighted: false,
        testID: 'shopping-list-add-button',
      });
    }

    return {
      left: [] as SearchBarAction[],
      right: rightActions,
    };
  }, [
    handleAddItem,
    handleAddItemFromSearch,
    handleOpenSelector,
    searchQuery,
    sortableItems.length,
    primaryColor,
    primaryLightColor,
    colors,
  ]);

  // Use ref to track currentListId for scanner
  const currentListIdRef = useRef(currentListId);
  useEffect(() => {
    currentListIdRef.current = currentListId;
  }, [currentListId]);

  // Set up scanner and telemetry
  useEffect(() => {
    setTimeout(() => {
      Telemetry.trackScreen('ShoppingListMain', {
        list_id: currentListId,
        item_count: items.length,
        purchased_count: items.filter(item => item.isPurchased).length,
        has_lists: lists.length > 0,
      });
    }, 0);

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
      setScannerProps(undefined, false);
    };
  }, [setScannerProps, navigateTo, currentListId, items, lists.length]);

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
      <ShoppingListActionsProvider
        onIncrementQuantity={handleIncrementQuantity}
        onDecrementQuantity={handleDecrementQuantity}
      >
        <View style={styles.container}>
          <ListTemplate
            items={[]}
            showUserHeader={true}
            showSearchBar={false}
            emptyState={noListsEmptyState}
            hasNoData={true}
          />
        </View>
      </ShoppingListActionsProvider>
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
    <ShoppingListActionsProvider
      onIncrementQuantity={handleIncrementQuantity}
      onDecrementQuantity={handleDecrementQuantity}
    >
      <View style={styles.container} testID="shopping-list-screen">
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
          showUserHeader={true}
          showSearchBar={true}
          searchBarActions={searchBarActions}
          testIDPrefix="shopping-list-item"
          emptyState={emptyStateConfig}
          customListComponent={ShoppingListTabs}
          customListProps={{
            loading: isLoadingInitial,
            onSortOrderUpdate: searchQuery.trim()
              ? undefined
              : handleSortOrderUpdate,
            onTogglePurchase: handleTogglePurchase,
            onRefresh: handleRefresh,
            refreshing,
            disabled: !!searchQuery.trim(),
            onClearAllPurchased: handleClearAllPurchased,
            onSwipeableWillOpen: handleSwipeableWillOpen,
            onSwipeableClose: handleSwipeableClose,
          }}
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
      </View>
    </ShoppingListActionsProvider>
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
