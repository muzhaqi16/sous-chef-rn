import React, {
  useMemo,
  useEffect,
  useCallback,
  useRef,
  useState,
} from 'react';
import { Alert, Image, View, Text, TouchableOpacity } from 'react-native';
import { ScrollView, RefreshControl } from 'react-native-gesture-handler';
import { useApolloClient } from '@apollo/client/react';
import { useAppNavigation } from '#hooks';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import {
  ShoppingListItemFragmentDoc,
  useGetShoppingListsQuery,
  useMoveShoppingListItemMutation,
  useUpdateShoppingListItemQuantityMutation,
} from '#generated';
import { useScanner } from '#context';
import {
  SearchBarAction,
  AnimatedItemSelector,
  SortableShoppingList,
  ListTemplate,
  CollapsiblePurchasedSection,
} from '#components';
import { EmptyState } from '#components/base/EmptyState';
import { getItemImageUrl } from '#utils/imageUtils';
import { generatePosition } from '#/utils/fractionalIndexing';
import {
  GetShoppingListItemsDocument,
  GetShoppingListItemsQuery,
} from '#generated';
import { Icon } from '#utils';
import type {
  SelectorConfig,
  ItemSelectorRef,
} from '#components/organisms/AnimatedItemSelector';
import type { SortableShoppingListItem } from '#components/organisms/SortableShoppingList';
import { useShoppingListManagement } from '#/hooks';
import { useStore } from '#/store';
import { IconLibrary } from '#/utils/iconUtils';
import { ShoppingListItemCounter } from '#/components/molecules/ShoppingListItemCounter';
import { commonStyles } from '#/styles';
import { useOptimisticDataRestorationMultiple } from '#/hooks/offline/useOptimisticDataRestoration';
import {
  handleVersionConflict,
  getVersionConflictMessage,
} from '#/utils/errors/versionConflict';
import { useAuth } from '#/hooks/auth/useAuth';
import { isShoppingListOwner } from '#utils/ownershipHelpers';
import { ShoppingListAvatar } from '#components/atoms';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';

// Wrapper component that conditionally renders EmptyState or SortableShoppingList
const ShoppingListContent: React.FC<{
  items: SortableShoppingListItem[];
  onItemPress: (id: string) => void;
  onItemEdit?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  onTogglePurchase?: (id: string) => void;
  onSortOrderUpdate?: (
    itemId: string,
    afterItemId: string | null,
    beforeItemId: string | null,
  ) => Promise<void>;
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
  disabled?: boolean;
  emptyState?: any;
  onClearAllPurchased?: () => Promise<void>;
  onSwipeableWillOpen?: (ref: any) => void;
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
  onSwipeableWillOpen,
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
        onSwipeableWillOpen={onSwipeableWillOpen}
        ListFooterComponent={
          /* Collapsible Purchased Section */
          <CollapsiblePurchasedSection
            purchasedItems={purchasedItems}
            unpurchasedCount={unpurchasedItems.length}
            onItemPress={onItemPress}
            onItemEdit={onItemEdit}
            onItemDelete={onItemDelete}
            onTogglePurchase={onTogglePurchase}
            onSortOrderUpdate={onSortOrderUpdate}
            onClearAll={onClearAllPurchased}
            disabled={disabled}
            onSwipeableWillOpen={onSwipeableWillOpen}
          />
        }
      />
    </>
  );
};

export const ShoppingListMain: React.FC = () => {
  // Restore optimistic data on mount (offline changes that haven't synced)
  useOptimisticDataRestorationMultiple(['ShoppingList', 'ShoppingListItem']);

  const { navigate, navigateTo } = useAppNavigation();
  const client = useApolloClient();
  const {
    theme: { colors },
  } = useUnistyles();
  const { primary: primaryColor, primaryLight: primaryLightColor } = colors;
  // Step 2: Use the extracted variables INSIDE useMemo
  const { selectedShoppingListId, setSelectedShoppingListId } = useStore();
  const { user } = useAuth();
  const selectorRef = useRef<ItemSelectorRef>(null);
  const { setScannerProps, setOverlayOpen } = useScanner();
  // Track currently open swipeable across both unpurchased and purchased lists
  const openSwipeableRef = useRef<any>(null);
  const [moveItem] = useMoveShoppingListItemMutation({
    errorPolicy: 'all',
    // Optimistic response for instant UI feedback
    optimisticResponse: variables => {
      // Find the moved item
      const movedItem = items.find(item => item.id === variables.input.itemId);
      if (!movedItem) {
        return { __typename: 'Mutation', moveShoppingListItem: null as any };
      }

      // Calculate optimistic sortOrder using fractional indexing
      const afterItem = variables.input.afterItemId
        ? items.find(item => item.id === variables.input.afterItemId)
        : null;
      const beforeItem = variables.input.beforeItemId
        ? items.find(item => item.id === variables.input.beforeItemId)
        : null;

      // Generate new position between neighbors
      const optimisticSortOrder = generatePosition(
        afterItem?.sortOrder ?? null,
        beforeItem?.sortOrder ?? null,
      );

      // Return updated item with new sortOrder
      return {
        __typename: 'Mutation',
        moveShoppingListItem: {
          ...movedItem,
          sortOrder: optimisticSortOrder,
          updatedAt: new Date().toISOString(),
          __typename: 'ShoppingListItem',
        },
      };
    },
    // Update cache to reflect new order
    update(cache, { data }) {
      if (!data?.moveShoppingListItem || !currentListId) return;

      try {
        // Read the current shopping list items query
        const queryResult = cache.readQuery<GetShoppingListItemsQuery>({
          query: GetShoppingListItemsDocument,
          variables: { shoppingListId: currentListId },
        });

        if (!queryResult?.shoppingListItems) return;

        // Create new array with updated item
        const updatedItems = queryResult.shoppingListItems.map(item =>
          item.id === data.moveShoppingListItem.id
            ? { ...item, sortOrder: data.moveShoppingListItem.sortOrder }
            : item,
        );

        // Sort by sortOrder (server returns them sorted, so we should too)
        const sortedItems = [...updatedItems].sort((a, b) =>
          a.sortOrder.localeCompare(b.sortOrder),
        );

        // Write back to cache
        cache.writeQuery({
          query: GetShoppingListItemsDocument,
          variables: { shoppingListId: currentListId },
          data: { shoppingListItems: sortedItems },
        });
      } catch (error) {
        console.warn('Cache update failed for moveItem:', error);
        // Don't throw - let mutation succeed even if cache update fails
      }
    },
  });
  const [updateQuantity] = useUpdateShoppingListItemQuantityMutation({
    errorPolicy: 'all',
    // No optimisticResponse here - will be passed at call site with fresh cache data
    // This avoids stale closure issues as per Apollo best practices
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
    searchQuery,
    setSearchQuery,
    addItem,
    toggleItem,
    removeItem,
    refetch: refetchItems,
  } = useShoppingListManagement(currentListId);

  // Let Apollo handle all data management - no manual optimization needed

  // Create selector configuration for shopping lists with owner info
  const listConfig: SelectorConfig<any> = useMemo(
    () => ({
      title: 'Select Shopping List',
      data: lists.map(list => {
        const isOwner = isShoppingListOwner(list, user?.id);
        return {
          ...list,
          // Add computed properties for display
          _isOwner: isOwner,
        };
      }),
      selectedId: currentListId,
      onSelect: (id: string) => {
        setSelectedShoppingListId(id);
        selectorRef.current?.close();
      },
      displayProperty: 'name',
      loading: false,
      emptyMessage: 'No shopping lists available',
      // Custom render for list items with avatar and role badge
      renderCustomItem: (
        list: any,
        isSelected: boolean,
        onPress: () => void,
      ) => (
        <TouchableOpacity
          style={[
            styles.selectorItemContainer,
            isSelected && styles.selectorItemSelected,
          ]}
          onPress={onPress}
        >
          <ShoppingListAvatar list={list} size={40} />
          <View style={styles.selectorItemInfo}>
            <Text style={styles.selectorItemName}>{list.name}</Text>
            <Text style={styles.selectorItemSubtext}>
              {list._isOwner
                ? 'You own this list'
                : `Shared by ${
                    list.ownerships?.[0]?.user?.profile?.displayName ||
                    list.ownerships?.[0]?.user?.email ||
                    'someone'
                  }`}
            </Text>
          </View>
          {isSelected && (
            <Icon
              name="check"
              size={20}
              color={colors.primary}
              library="MaterialIcons"
            />
          )}
        </TouchableOpacity>
      ),
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
    [
      lists,
      currentListId,
      user?.id,
      setSelectedShoppingListId,
      navigate,
      colors,
    ],
  );

  const handleSortOrderUpdate = useCallback(
    async (
      itemId: string,
      afterItemId: string | null,
      beforeItemId: string | null,
    ) => {
      if (!currentListId) return;

      try {
        // Find the current item from cache to preserve all fields
        const currentItem = items.find(item => item.id === itemId);
        if (!currentItem) {
          console.error('Item not found in cache:', itemId);
          return;
        }

        // Execute mutation with optimistic response and cache update
        await moveItem({
          variables: {
            input: {
              itemId,
              afterItemId: afterItemId ?? undefined,
              beforeItemId: beforeItemId ?? undefined,
            },
          },
        });
      } catch (error) {
        console.error('Failed to move item:', error);
        Alert.alert('Error', 'Failed to reorder items');
      }
    },
    [currentListId, moveItem, items],
  );

  // Quantity update handlers using specialized mutation (80% payload reduction)
  const handleIncrementQuantity = useCallback(
    async (itemId: string) => {
      // Find item from the items array (already available from hook)
      const currentItem = items.find(item => item.id === itemId);

      if (!currentItem) {
        console.warn('Item not found:', itemId);
        return;
      }

      const newQuantity = (currentItem.quantity || 1) + 1;

      const cacheId = client.cache.identify({
        __typename: 'ShoppingListItem',
        id: itemId,
      });
      const fullItem = cacheId
        ? client.readFragment<any>({
            id: cacheId,
            fragment: ShoppingListItemFragmentDoc,
            fragmentName: 'ShoppingListItemFragment',
          })
        : null;
      const optimisticItem = fullItem ?? currentItem ?? null;

      try {
        optimisticDataPersistence.save(
          'ShoppingListItem',
          itemId,
          'quantity',
          newQuantity,
        );

        await updateQuantity({
          variables: {
            id: itemId,
            quantity: newQuantity,
            version: currentItem.version,
          },
          optimisticResponse: optimisticItem
            ? {
                __typename: 'Mutation',
                updateShoppingListItemQuantity: {
                  ...optimisticItem,
                  __typename: 'ShoppingListItem',
                  quantity: newQuantity,
                  // Keep current version; server response will deliver incremented version
                  version: optimisticItem.version ?? currentItem.version,
                  updatedAt: new Date().toISOString(),
                },
              }
            : {
                __typename: 'Mutation',
                updateShoppingListItemQuantity: {
                  __typename: 'ShoppingListItem',
                  id: itemId,
                  quantity: newQuantity,
                  version: currentItem.version,
                  updatedAt: new Date().toISOString(),
                } as any,
              },
          onCompleted: data => {
            if (data?.updateShoppingListItemQuantity) {
              optimisticDataPersistence.clear(
                'ShoppingListItem',
                data.updateShoppingListItemQuantity.id,
                'quantity',
              );
            }
          },
        });
      } catch (error: any) {
        if (handleVersionConflict(error)) {
          Alert.alert('Item Updated', getVersionConflictMessage(error), [
            { text: 'Refresh', onPress: () => refetchItems() },
            { text: 'Cancel', style: 'cancel' },
          ]);
          return;
        }
        console.error('Failed to update quantity:', error);
        Alert.alert('Error', 'Failed to update quantity');
      }
    },
    [updateQuantity, refetchItems, items, client],
  );

  const handleDecrementQuantity = useCallback(
    async (itemId: string) => {
      // Find item from the items array (already available from hook)
      const currentItem = items.find(item => item.id === itemId);

      if (!currentItem) {
        console.warn('Item not found:', itemId);
        return;
      }

      const newQuantity = Math.max(0, (currentItem.quantity || 1) - 1);

      const cacheId = client.cache.identify({
        __typename: 'ShoppingListItem',
        id: itemId,
      });
      const fullItem = cacheId
        ? client.readFragment<any>({
            id: cacheId,
            fragment: ShoppingListItemFragmentDoc,
            fragmentName: 'ShoppingListItemFragment',
          })
        : null;
      const optimisticItem = fullItem ?? currentItem ?? null;

      try {
        optimisticDataPersistence.save(
          'ShoppingListItem',
          itemId,
          'quantity',
          newQuantity,
        );

        await updateQuantity({
          variables: {
            id: itemId,
            quantity: newQuantity,
            version: currentItem.version,
          },
          optimisticResponse: optimisticItem
            ? {
                __typename: 'Mutation',
                updateShoppingListItemQuantity: {
                  ...optimisticItem,
                  __typename: 'ShoppingListItem',
                  quantity: newQuantity,
                  version: optimisticItem.version ?? currentItem.version,
                  updatedAt: new Date().toISOString(),
                },
              }
            : {
                __typename: 'Mutation',
                updateShoppingListItemQuantity: {
                  __typename: 'ShoppingListItem',
                  id: itemId,
                  quantity: newQuantity,
                  version: currentItem.version,
                  updatedAt: new Date().toISOString(),
                } as any,
              },
          onCompleted: data => {
            if (data?.updateShoppingListItemQuantity) {
              optimisticDataPersistence.clear(
                'ShoppingListItem',
                data.updateShoppingListItemQuantity.id,
                'quantity',
              );
            }
          },
        });
      } catch (error: any) {
        if (handleVersionConflict(error)) {
          Alert.alert('Item Updated', getVersionConflictMessage(error), [
            { text: 'Refresh', onPress: () => refetchItems() },
            { text: 'Cancel', style: 'cancel' },
          ]);
          return;
        }
        console.error('Failed to update quantity:', error);
        Alert.alert('Error', 'Failed to update quantity');
      }
    },
    [updateQuantity, refetchItems, items, client],
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
      const imageUrl = getItemImageUrl(item.item);

      // Get primary category from item.item.categories
      const primaryCategory = item.item?.categories?.find(
        (cat: any) => cat.isPrimary,
      );
      const categoryName =
        primaryCategory?.category?.name ||
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
          <ShoppingListItemCounter
            quantity={item.quantity || 0}
            unit={item.unit?.symbol || item.unitName}
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
      // OPTIMIZATION: No refetch needed - removeItem updates cache via cache.modify
      // Cache automatically updates via Apollo's normalized cache
    } catch (error) {
      Alert.alert('Error', 'Failed to delete item');
    }
  };

  const handleClearAllPurchased = useCallback(async () => {
    const purchasedItems = items.filter((item: any) => item.isPurchased);

    if (purchasedItems.length === 0) return;

    try {
      // Delete all purchased items
      await Promise.all(purchasedItems.map(item => removeItem(item.id)));

      // OPTIMIZATION: No refetch needed - each removeItem updates cache via cache.modify
      // Cache automatically updates via Apollo's normalized cache
    } catch (error) {
      Alert.alert('Error', 'Failed to clear purchased items');
    }
  }, [items, removeItem]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetchItems();
    } finally {
      setRefreshing(false);
    }
  }, [refetchItems]);

  // Handle swipeable item opening - ensure only one item is open at a time across both lists
  const handleSwipeableWillOpen = useCallback((ref: any) => {
    if (openSwipeableRef.current && openSwipeableRef.current !== ref) {
      // Close the previously open swipeable
      openSwipeableRef.current.current?.close();
    }
    // Update to track the newly opening swipeable
    openSwipeableRef.current = ref;
  }, []);

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
        onPress: () => {
          setOverlayOpen(true);
          selectorRef.current?.open();
        },
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
    searchQuery,
    sortableItems.length,
    primaryColor, // ← Include extracted variable in deps
    primaryLightColor, // ← Include extracted variable in deps
    colors,
    setOverlayOpen,
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
    icon: 'add-shopping-cart',
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
