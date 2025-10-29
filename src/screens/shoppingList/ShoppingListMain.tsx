import React, {
  useMemo,
  useEffect,
  useCallback,
  useRef,
  useState,
} from 'react';
import { Alert, View } from 'react-native';
import { useAppNavigation } from '#hooks';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useGetShoppingListsQuery } from '#generated';
import { useApolloClient } from '@apollo/client/react';
import { useScanner } from '#context';
import {
  SearchBarAction,
  AnimatedItemSelector,
  ListTemplate,
} from '#components';
import { ShoppingListContent } from '#components/organisms/ShoppingListContent';
import type { ItemSelectorRef } from '#components/organisms/AnimatedItemSelector';
import type { SortableShoppingListItem } from '#components/organisms/SortableShoppingList';
import {
  useShoppingListManagement,
  useQuantityManagement,
  usePurchasedItemsManagement,
  useShoppingListItemTransformation,
  useShoppingListSelectorConfig,
  useItemReordering,
} from '#/hooks/shoppingList';
import { useStore } from '#/store';
import { useAuth } from '#/hooks/auth/useAuth';
import { useHaptic } from '#hooks/haptic';
import { useScreenTransition } from '#hooks/performance';
import { useSwipeableCoordinator, useSelectorManagement } from '#hooks/ui';
import { FRAGMENT_NAMES } from '#/constants/shoppingList';

export const ShoppingListMain: React.FC = () => {
  const { navigate, navigateTo } = useAppNavigation();
  const {
    theme: { colors },
  } = useUnistyles();
  const { primary: primaryColor, primaryLight: primaryLightColor } = colors;
  // Step 2: Use the extracted variables INSIDE useMemo
  const { selectedShoppingListId, setSelectedShoppingListId } = useStore();
  const { user } = useAuth();
  const selectorRef = useRef<ItemSelectorRef>(null);
  const { setScannerProps, setOverlayOpen } = useScanner();
  const client = useApolloClient();
  const haptic = useHaptic();

  // Track screen performance
  useScreenTransition('ShoppingListMain');

  // Coordinate swipeable items - only one open at a time
  const { handleSwipeableWillOpen } = useSwipeableCoordinator();

  // Manage selector with overlay coordination
  const { handleOpenSelector, handleOverlayOpen, handleOverlayClose } =
    useSelectorManagement({
      selectorRef,
      setOverlayOpen,
    });

  const [refreshing, setRefreshing] = useState(false);

  // Use cache-and-network like pantry and recipes - Apollo handles offline gracefully
  const { data, previousData } = useGetShoppingListsQuery({
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'all',
  });

  // OPTIMIZATION: Fall back to previousData if current data is unavailable (network error)
  const lists = useMemo(
    () => data?.shoppingLists ?? previousData?.shoppingLists ?? [],
    [data?.shoppingLists, previousData?.shoppingLists],
  );

  // Get the default list or the first list if none is default
  const defaultList = lists.find(list => list.isDefault) || lists[0];
  const currentListId = selectedShoppingListId || defaultList?.id;
  const currentList =
    lists.find(list => list.id === currentListId) || defaultList;

  // Auto-select the default list if none is selected or if selected list no longer exists
  useEffect(() => {
    const selectedListExists =
      selectedShoppingListId &&
      lists.some(list => list.id === selectedShoppingListId);

    if (!selectedShoppingListId || !selectedListExists) {
      if (defaultList?.id) {
        setSelectedShoppingListId(defaultList.id);
      }
    }
  }, [
    selectedShoppingListId,
    defaultList?.id,
    setSelectedShoppingListId,
    lists,
  ]);

  // Use the shopping list hook for both data and mutations to ensure consistency
  const {
    items,
    loading,
    searchQuery,
    setSearchQuery,
    addItem,
    toggleItem,
    removeItem,
    refetch: refetchItems,
  } = useShoppingListManagement(currentListId);

  // Quantity management with version conflict handling
  const { incrementQuantity, decrementQuantity } = useQuantityManagement({
    onRefetch: refetchItems,
  });

  // Purchased items management with haptic feedback
  const { handleTogglePurchase, handleClearAllPurchased } =
    usePurchasedItemsManagement({
      items,
      toggleItem,
      removeItem,
      haptic,
    });

  // Item reordering with optimistic updates
  const { handleSortOrderUpdate } = useItemReordering({
    listId: currentListId,
    items,
  });

  // Let Apollo handle all data management - no manual optimization needed

  // Create selector configuration for shopping lists with owner info
  const listConfig = useShoppingListSelectorConfig({
    lists,
    currentListId,
    userId: user?.id,
    setSelectedListId: setSelectedShoppingListId,
    selectorRef,
    navigate,
    colors,
    styles,
  });

  // Transform shopping list items for SortableShoppingList
  const sortableItems = useShoppingListItemTransformation({
    items,
    incrementQuantity,
    decrementQuantity,
  });

  const handleAddItem = useCallback(() => {
    if (!currentListId) {
      Alert.alert(
        'No List Selected',
        'Please select or create a shopping list first.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Create List',
            onPress: () => navigate('ListSettings'),
          },
        ],
      );
      return;
    }
    navigate('AddItem', { listId: currentListId });
  }, [currentListId, navigate]); // Add dependencies here

  const handleAddItemFromSearch = useCallback(
    async (itemName: string) => {
      if (!currentListId) {
        Alert.alert('Error', 'Please select a shopping list first');
        return;
      }

      try {
        const result = await addItem({
          itemName: itemName.trim(),
          quantity: 1,
        });

        if (result) {
          haptic.success(); // Haptic feedback on successful add
          setSearchQuery(''); // Clear search after adding
        } else {
          haptic.error(); // Error haptic on failure
          Alert.alert('Error', 'Failed to add item');
        }
      } catch (error) {
        haptic.error(); // Error haptic on exception
        Alert.alert('Error', 'Failed to add item');
      }
    },
    [currentListId, addItem, setSearchQuery, haptic],
  );

  const handleDeleteItem = async (itemId: string) => {
    try {
      haptic.warning(); // Haptic feedback on delete
      await removeItem(itemId);
      // OPTIMIZATION: No refetch needed - removeItem updates cache via cache.modify
      // Cache automatically updates via Apollo's normalized cache
    } catch (error) {
      haptic.error(); // Error haptic on failure
      Alert.alert('Error', 'Failed to delete item');
    }
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetchItems();
    } finally {
      setRefreshing(false);
    }
  }, [refetchItems]);

  // Search bar actions - conditionally show "Add" button when searching with no results

  const searchBarActions = useMemo(() => {
    const hasSearchWithNoResults =
      searchQuery.trim() && sortableItems.length === 0;
    const rightActions: SearchBarAction[] = [
      {
        icon: 'refresh',
        color: colors.white,
        onPress: handleRefresh,
      },
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
        color: primaryColor, // ← Use extracted variable, NOT theme.colors.primary
        backgroundColor: primaryLightColor, // ← Use extracted variable
      });
    } else {
      rightActions.unshift({
        icon: 'add',
        onPress: handleAddItem,
        color: primaryColor, // ← Use extracted variable
        backgroundColor: colors.surface,
      });
    }

    return {
      left: [] as SearchBarAction[],
      right: rightActions,
    };
  }, [
    handleAddItem,
    handleAddItemFromSearch,
    handleRefresh,
    handleOpenSelector,
    searchQuery,
    sortableItems.length,
    primaryColor,
    primaryLightColor,
    colors,
  ]);

  const handleScanPress = useCallback(() => {
    navigateTo.barcode({
      source: 'shoppingList',
      shoppingListId: currentListId,
    });
  }, [navigateTo, currentListId]);

  // Set up scanner button when component mounts
  useEffect(() => {
    setScannerProps(handleScanPress, true);

    // Clean up on unmount
    return () => {
      setScannerProps(undefined, false);
    };
  }, [setScannerProps, handleScanPress]);

  // If no lists exist at all
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
        <ListTemplate
          items={[]}
          showUserHeader={true}
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
    <View style={styles.container}>
      <ListTemplate
        items={sortableItems}
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
        emptyState={emptyStateConfig}
        customListComponent={ShoppingListContent}
        customListProps={{
          loading,
          onSortOrderUpdate: searchQuery.trim()
            ? undefined
            : handleSortOrderUpdate,
          onTogglePurchase: handleTogglePurchase,
          onRefresh: handleRefresh,
          refreshing,
          disabled: !!searchQuery.trim(),
          onClearAllPurchased: handleClearAllPurchased,
          onSwipeableWillOpen: handleSwipeableWillOpen,
        }}
      />

      <AnimatedItemSelector
        ref={selectorRef}
        config={listConfig}
        maxHeight={600}
        onOpen={handleOverlayOpen}
        onClose={handleOverlayClose}
      />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  selectorItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.md,
    borderRadius: theme.radii.md,
    marginBottom: theme.spacing.xs,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  selectorItemSelected: {
    backgroundColor:
      (theme.colors as any).primaryLight || theme.colors.primary + '10',
    borderColor: theme.colors.primary,
  },
  selectorItemInfo: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  selectorItemName: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  selectorItemSubtext: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
  },
}));
