import React, {
  useMemo,
  useEffect,
  useCallback,
  useRef,
  useState,
} from 'react';
import { Alert, Image, View } from 'react-native';
import { ScrollView, RefreshControl } from 'react-native-gesture-handler';
import { useAppNavigation } from '#hooks';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import {
  useGetShoppingListsQuery,
  useMoveShoppingListItemMutation,
} from '#generated';
import { useScanner } from '#context';
import {
  SearchBarAction,
  AnimatedItemSelector,
  SortableShoppingList,
  EmptyState,
  ListTemplate,
  CollapsiblePurchasedSection,
} from '#components';
import { getItemImageUrl } from '#utils/imageUtils';
import { generatePosition } from '#utils/fractionalIndexing';
import { enhanceWithVersion } from '#/apollo/utils/createOptimisticResponse';
import type {
  SelectorConfig,
  ItemSelectorRef,
} from '#components/organisms/AnimatedItemSelector';
import type {
  SortableShoppingListItem,
} from '#components/organisms/SortableShoppingList';
import { useShoppingListManagement } from '#/hooks';
import { useStore } from '#/store';
import { IconLibrary } from '#/utils/iconUtils';
import { Counter } from '#/components/molecules/Counter';
import { commonStyles } from '#/styles';

// Wrapper component that conditionally renders EmptyState or SortableShoppingList
const ShoppingListContent: React.FC<{
  items: SortableShoppingListItem[];
  onItemPress: (id: string) => void;
  onItemEdit?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  onTogglePurchase?: (id: string) => void;
  onSortOrderUpdate?: (itemId: string, afterItemId: string | null, beforeItemId: string | null) => Promise<void>;
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
  disabled?: boolean;
  emptyState?: any;
  onClearAllPurchased?: () => Promise<void>;
}> = ({
  items,
  onItemPress,
  onItemEdit,
  onItemDelete,
  onTogglePurchase,
  onSortOrderUpdate,
  onRefresh,
  refreshing,
  disabled,
  emptyState,
  onClearAllPurchased,
}) => {
  // Separate items by purchased status
  const unpurchasedItems = items.filter(item => !item.isPurchased);
  const purchasedItems = items.filter(item => item.isPurchased);

  if (items.length === 0 && emptyState) {
    return (
      <ScrollView
        contentContainerStyle={{ flex: 1 }}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing || false}
              onRefresh={onRefresh}
            />
          ) : undefined
        }
      >
        <EmptyState {...emptyState} />
      </ScrollView>
    );
  }

  return (
    <>
      {/* Unpurchased Items */}
      <SortableShoppingList
        items={unpurchasedItems}
        onItemPress={onItemPress}
        onItemEdit={onItemEdit}
        onItemDelete={onItemDelete}
        onTogglePurchase={onTogglePurchase}
        onSortOrderUpdate={onSortOrderUpdate}
        disabled={disabled}
        showsVerticalScrollIndicator={true}
        ListFooterComponent={
          /* Collapsible Purchased Section */
          <CollapsiblePurchasedSection
            purchasedItems={purchasedItems}
            onItemPress={onItemPress}
            onItemEdit={onItemEdit}
            onItemDelete={onItemDelete}
            onTogglePurchase={onTogglePurchase}
            onSortOrderUpdate={onSortOrderUpdate}
            onClearAll={onClearAllPurchased}
            disabled={disabled}
          />
        }
      />
    </>
  );
};

export const ShoppingListMain: React.FC = () => {
  const { navigate, navigateTo } = useAppNavigation();
  const {
    theme: { colors },
  } = useUnistyles();
  const { primary: primaryColor, primaryLight: primaryLightColor } = colors;
  // Step 2: Use the extracted variables INSIDE useMemo
  const { selectedShoppingListId, setSelectedShoppingListId } = useStore();
  const selectorRef = useRef<ItemSelectorRef>(null);
  const { setScannerProps, setOverlayOpen } = useScanner();
  const [moveItem] = useMoveShoppingListItemMutation({
    errorPolicy: 'all',
  });
  const [refreshing, setRefreshing] = useState(false);

  const { data } = useGetShoppingListsQuery({
    fetchPolicy: 'cache-and-network',
  });

  const lists = useMemo(() => data?.shoppingLists || [], [data?.shoppingLists]);

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
    searchQuery,
    setSearchQuery,
    addItem,
    updateItem,
    toggleItem,
    removeItem,
    refetch: refetchItems,
  } = useShoppingListManagement(currentListId);

  // Create selector configuration for shopping lists
  const listConfig: SelectorConfig<any> = useMemo(
    () => ({
      title: 'Select Shopping List',
      data: lists,
      selectedId: currentListId,
      onSelect: (id: string) => {
        setSelectedShoppingListId(id);
        selectorRef.current?.close();
      },
      displayProperty: 'name',
      loading: false,
      emptyMessage: 'No shopping lists available',
      actions: [
        {
          icon: 'add',
          label: 'Create New List',
          onPress: () => {
            selectorRef.current?.close();
            navigate('ListSettings');
          },
          iconLibrary: 'MaterialIcons' as IconLibrary,
        },
        ...(currentListId
          ? [
              {
                icon: 'share',
                label: 'Share Current List',
                onPress: () => {
                  selectorRef.current?.close();
                  navigate('ShareList', { listId: currentListId });
                },
                iconLibrary: 'MaterialIcons' as IconLibrary,
              },
              {
                icon: 'settings',
                label: 'List Settings',
                onPress: () => {
                  selectorRef.current?.close();
                  navigate('ListSettings', {
                    listId: currentListId,
                  });
                },
                iconLibrary: 'MaterialIcons' as IconLibrary,
              },
            ]
          : []),
      ],
    }),
    [lists, currentListId, setSelectedShoppingListId, navigate],
  );


  const handleSortOrderUpdate = useCallback(
    async (itemId: string, afterItemId: string | null, beforeItemId: string | null) => {
      if (!currentListId) return;

      try {
        // Find the current item from cache to preserve all fields
        const currentItem = items.find(item => item.id === itemId);
        if (!currentItem) {
          console.error('Item not found in cache:', itemId);
          return;
        }

        // Calculate optimistic sortOrder using fractional indexing
        const afterItem = afterItemId ? items.find(item => item.id === afterItemId) : null;
        const beforeItem = beforeItemId ? items.find(item => item.id === beforeItemId) : null;
        const afterSortOrder = afterItem?.sortOrder ?? null;
        const beforeSortOrder = beforeItem?.sortOrder ?? null;

        // Generate new fractional index between the two items
        const optimisticSortOrder = generatePosition(afterSortOrder, beforeSortOrder);

        console.log('Optimistic sortOrder calculation:', {
          itemId,
          afterItemId,
          afterSortOrder,
          beforeItemId,
          beforeSortOrder,
          optimisticSortOrder,
        });

        await moveItem({
          variables: {
            input: {
              itemId,
              afterItemId: afterItemId ?? undefined,
              beforeItemId: beforeItemId ?? undefined,
            },
          },
          // Optimistic response: spread current item and only update sortOrder
          // This prevents Apollo cache errors about missing fields
          optimisticResponse: {
            __typename: 'Mutation',
            moveShoppingListItem: enhanceWithVersion(currentItem, {
              sortOrder: optimisticSortOrder,
            }) as any,
          },
        });

        console.log('✓ Item moved successfully:', { itemId, afterItemId, beforeItemId });
      } catch (error) {
        console.error('Failed to move item:', error);
        Alert.alert('Error', 'Failed to reorder items');
      }
    },
    [currentListId, moveItem, items],
  );

  // Quantity update handlers
  const handleIncrementQuantity = useCallback(
    async (itemId: string) => {
      const currentItem = items.find(item => item.id === itemId);
      if (!currentItem) return;

      try {
        await updateItem(itemId, { quantity: (currentItem.quantity || 1) + 1 });
      } catch (error) {
        Alert.alert('Error', 'Failed to update quantity');
      }
    },
    [items, updateItem],
  );

  const handleDecrementQuantity = useCallback(
    async (itemId: string) => {
      const currentItem = items.find(item => item.id === itemId);
      if (!currentItem) return;

      const newQuantity = Math.max(0, (currentItem.quantity || 1) - 1);
      try {
        await updateItem(itemId, { quantity: newQuantity });
      } catch (error) {
        Alert.alert('Error', 'Failed to update quantity');
      }
    },
    [items, updateItem],
  );

  // Transform shopping list items for SortableShoppingList
  const sortableItems = useMemo((): SortableShoppingListItem[] => {
    // Server already returns items sorted by: isPurchased ASC, sortOrder ASC, createdAt ASC
    // No need to re-sort on client - just separate by purchased status for UI
    const unpurchasedItems = items.filter((item: any) => !item.isPurchased);
    const purchasedItems = items.filter((item: any) => item.isPurchased);

    // Unpurchased first, then purchased (already sorted within each group by server)
    const sortedItems = [...unpurchasedItems, ...purchasedItems];

    // Map to SortableShoppingListItem format
    return sortedItems.map((item: any) => {
      const imageUrl = getItemImageUrl(item.item, 'small');

      // Get primary category from item.item.categories
      const primaryCategory = item.item?.categories?.find(
        (cat: any) => cat.isPrimary
      );
      const categoryName = primaryCategory?.category?.name ||
                          item.item?.categories?.[0]?.category?.name ||
                          item.category;

      return {
        id: item.id,
        title: item.itemName,
        subtitle: categoryName || undefined,
        sortOrder: item.sortOrder ?? 'zzz', // String fallback for fractional indexing
        isPurchased: item.isPurchased,
        badge: undefined,
        rightElement: (
          <Counter
            count={item.quantity}
            onIncrement={() => handleIncrementQuantity(item.id)}
            onDecrement={() => handleDecrementQuantity(item.id)}
          />
        ),
        leftElement: imageUrl ? (
          <View
            style={[
              commonStyles.listItemImageContainer,
              item.isPurchased && { opacity: 0.5 },
            ]}
          >
            <Image
              source={{ uri: imageUrl }}
              style={commonStyles.listItemImage}
            />
          </View>
        ) : null,
      };
    });
  }, [items, handleIncrementQuantity, handleDecrementQuantity]);

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
          setSearchQuery(''); // Clear search after adding
        } else {
          Alert.alert('Error', 'Failed to add item');
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to add item');
      }
    },
    [currentListId, addItem, setSearchQuery],
  );

  const handleDeleteItem = async (itemId: string) => {
    try {
      await removeItem(itemId);
      // Refetch to ensure UI is in sync after deletion
      await refetchItems();
    } catch (error) {
      Alert.alert('Error', 'Failed to delete item');
    }
  };

  const handleClearAllPurchased = useCallback(async () => {
    const purchasedItems = items.filter((item: any) => item.isPurchased);

    if (purchasedItems.length === 0) return;

    try {
      // Delete all purchased items
      await Promise.all(
        purchasedItems.map(item => removeItem(item.id))
      );

      // Refetch to ensure UI is in sync
      await refetchItems();
    } catch (error) {
      Alert.alert('Error', 'Failed to clear purchased items');
    }
  }, [items, removeItem, refetchItems]);

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
        color: '#fff',
        onPress: handleRefresh,
      },
      {
        icon: 'list',
        color: '#fff',
        onPress: () => selectorRef.current?.open(),
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
        backgroundColor: 'white',
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
    searchQuery,
    sortableItems.length,
    primaryColor, // ← Include extracted variable in deps
    primaryLightColor, // ← Include extracted variable in deps
  ]);

  const handleOverlayOpen = useCallback(() => {
    setOverlayOpen(true);
  }, [setOverlayOpen]);

  const handleOverlayClose = useCallback(() => {
    setOverlayOpen(false);
  }, [setOverlayOpen]);

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
          onSortOrderUpdate: searchQuery.trim()
            ? undefined
            : handleSortOrderUpdate,
          onTogglePurchase: toggleItem,
          onRefresh: handleRefresh,
          refreshing,
          disabled: !!searchQuery.trim(),
          onClearAllPurchased: handleClearAllPurchased,
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
}));
