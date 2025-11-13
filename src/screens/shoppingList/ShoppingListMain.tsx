import React, {
  useMemo,
  useEffect,
  useCallback,
  useRef,
  useState,
  useLayoutEffect,
  startTransition,
} from 'react';
import { Alert, View, Text, TouchableOpacity } from 'react-native';
import { PaginationFooter } from '#/components/organisms/PaginationFooter';
import { useApolloClient } from '@apollo/client/react';
import { useAppNavigation } from '#hooks';
import { toastService } from '#/services/toastService';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import {
  ShoppingListItemFragmentDoc,
  useGetShoppingListsQuery,
  useMoveShoppingListItemMutation,
  useUpdateShoppingListItemQuantityMutation,
  GetShoppingListItemsDocument,
  GetShoppingListItemsQuery,
} from '#generated';
import { useScanner } from '#context';
import {
  SearchBarAction,
  AnimatedItemSelector,
  ListTemplate,
} from '#components';
import { Icon } from '#utils';
import type {
  SelectorConfig,
  ItemSelectorRef,
} from '#components/organisms/AnimatedItemSelector';
import type { SortableShoppingListItem } from '#components/organisms/SortableShoppingList';
import { useShoppingListManagement } from '#/hooks';
import { useAppStore, selectSelectedShoppingListId } from '#store/useAppStore';
import { IconLibrary } from '#/utils/iconUtils';
import { useOptimisticDataRestorationMultiple } from '#/hooks/offline/useOptimisticDataRestoration';
import {
  handleVersionConflict,
  getVersionConflictMessage,
} from '#/utils/errors/versionConflict';
import { useAuth } from '#/hooks/auth/useAuth';
import { isShoppingListOwner } from '#utils/ownershipHelpers';
import { ShoppingListAvatar } from '#components/atoms';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { useFeatureHint } from '#/hooks/useFeatureHint';
import { SwipeHintOverlay } from '#/components/organisms/SwipeHintOverlay';
import { useHaptic } from '#hooks/haptic';
import { useScreenTransition } from '#hooks/performance';
import { useSelectorManagement } from '#hooks/ui';
import { getItemImageUrl } from '#utils/imageUtils';
import { Telemetry } from '#/services/telemetry';
import { ShoppingListTabs } from '#/components/organisms/ShoppingListTabs';
import { ShoppingListActionsProvider } from '#context/ShoppingListActionsContext';

export const ShoppingListMain: React.FC = () => {
  // Restore optimistic data on mount (offline changes that haven't synced)
  useOptimisticDataRestorationMultiple(['ShoppingList', 'ShoppingListItem']);

  // Feature hint for swipe gesture (shows once, after items load)
  const swipeHint = useFeatureHint({
    featureId: 'shopping_list_swipe',
    showOnMount: false, // We'll manually trigger when items are available
  });

  const { navigate, navigateTo } = useAppNavigation();
  const client = useApolloClient();
  const {
    theme: { colors },
  } = useUnistyles();
  const { primary: primaryColor, primaryLight: primaryLightColor } = colors;
  const selectedShoppingListId = useAppStore(selectSelectedShoppingListId);
  const setSelectedShoppingListId = useAppStore(
    state => state.setSelectedShoppingListId,
  );
  const { user } = useAuth();
  const selectorRef = useRef<ItemSelectorRef>(null);
  const { setScannerProps, setOverlayOpen } = useScanner();
  const haptic = useHaptic();

  // Track screen performance
  useScreenTransition('ShoppingListMain');

  // Manage selector with overlay coordination
  const { handleOpenSelector, handleOverlayOpen, handleOverlayClose } =
    useSelectorManagement({
      selectorRef,
      setOverlayOpen,
    });

  // Track currently open swipeable across both unpurchased and purchased lists
  const openSwipeableRef = useRef<any>(null);
  const [moveItem] = useMoveShoppingListItemMutation({
    errorPolicy: 'all',
    // Optimistic response for instant UI feedback
    optimisticResponse: variables => {
      // Find the moved item
      const movedItem = items.find(item => item.id === variables.input.itemId);
      if (!movedItem) {
        // Return the first item as a fallback - the real mutation will handle errors
        // This prevents type errors while still allowing the mutation to proceed
        return {
          __typename: 'Mutation',
          moveShoppingListItem: items[0] || {
            __typename: 'ShoppingListItem',
            id: variables.input.itemId,
          },
        };
      }

      // Calculate optimistic sortOrder based on afterItemId
      const afterItem = variables.input.afterItemId
        ? items.find(item => item.id === variables.input.afterItemId)
        : null;

      // Use fractional indexing for sortOrder
      const optimisticSortOrder = afterItem?.sortOrder || movedItem.sortOrder;

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
  // OPTIMIZATION: Use startTransition to batch this state update with subsequent renders
  useEffect(() => {
    const selectedListExists =
      selectedShoppingListId &&
      lists.some(list => list.id === selectedShoppingListId);

    if (!selectedShoppingListId || !selectedListExists) {
      if (defaultList?.id) {
        startTransition(() => {
          setSelectedShoppingListId(defaultList.id);
        });
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
    loadMore,
    hasMore,
    isLoadingMore,
  } = useShoppingListManagement(currentListId);

  // Refs for stable callbacks (avoid recreating callbacks on items change)
  const updateQuantityRef = useRef(updateQuantity);
  const refetchItemsRef = useRef(refetchItems);

  // Keep refs updated
  useLayoutEffect(() => {
    updateQuantityRef.current = updateQuantity;
    refetchItemsRef.current = refetchItems;
  }, [updateQuantity, refetchItems]);

  // Show swipe hint after items load (only once, only if there are unpurchased items)
  useEffect(() => {
    if (items.length > 0 && !swipeHint.hasBeenShown) {
      const unpurchasedItems = items.filter((item: any) => !item.isPurchased);
      if (unpurchasedItems.length > 0) {
        // Show hint after a brief delay to let UI settle
        const timer = setTimeout(() => {
          swipeHint.show();
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, swipeHint.hasBeenShown, swipeHint.show]);

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
      afterSortOrder: string | null,
      beforeSortOrder: string | null,
    ) => {
      if (!currentListId) return;

      try {
        // DEFENSIVE CHECK: Detect duplicate sortOrder values
        // This prevents the 'Zm >= Zm' fractional indexing error
        if (
          afterSortOrder !== null &&
          beforeSortOrder !== null &&
          afterSortOrder === beforeSortOrder
        ) {
          console.error('❌ Duplicate sortOrder detected:', {
            afterItemId,
            afterSortOrder,
            beforeItemId,
            beforeSortOrder,
          });

          // Trigger refetch to get clean data from server
          Alert.alert(
            'Error',
            'Item positions are out of sync. Refreshing list...',
          );
          await refetchItems();
          return;
        }

        // Execute mutation with optimistic response and cache update
        // Note: Server will use afterItemId/beforeItemId to look up sortOrder values
        // and generate the new position. We pass sortOrder here only for validation.
        // Note: Item is already marked as reordered in SortableList.tsx before this call
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
        toastService.error('Failed to reorder items');
      }
    },
    [currentListId, moveItem, refetchItems],
  );

  // Quantity update handlers using specialized mutation (80% payload reduction)
  // Using refs to avoid recreating callbacks on every items change
  const handleIncrementQuantity = useCallback(
    async (itemId: string) => {
      // Always read fresh data directly from Apollo cache
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

      if (!fullItem) {
        console.warn('Item not in cache, cannot increment:', itemId);
        return;
      }

      // Use fresh quantity from cache, not stale items array
      const newQuantity = (fullItem.quantity || 0) + 1;

      try {
        optimisticDataPersistence.save(
          'ShoppingListItem',
          itemId,
          'quantity',
          newQuantity,
        );

        await updateQuantityRef.current({
          variables: {
            itemId,
            quantity: newQuantity.toString(),
            version: fullItem.version,
          },
          optimisticResponse: {
            __typename: 'Mutation',
            updateShoppingListItemQuantity: {
              ...fullItem,
              __typename: 'ShoppingListItem',
              quantity: newQuantity,
              // Keep current version; server response will deliver incremented version
              version: fullItem.version,
              updatedAt: new Date().toISOString(),
            },
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
            { text: 'Refresh', onPress: () => refetchItemsRef.current() },
            { text: 'Cancel', style: 'cancel' },
          ]);
          return;
        }
        console.error('Failed to update quantity:', error);
        toastService.error('Failed to update quantity');
      }
    },
    [client], // Only client dependency - stable
  );

  const handleDecrementQuantity = useCallback(
    async (itemId: string) => {
      // Always read fresh data directly from Apollo cache
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

      if (!fullItem) {
        console.warn('Item not in cache, cannot decrement:', itemId);
        return;
      }

      // Use fresh quantity from cache, not stale items array
      const newQuantity = Math.max(0, (fullItem.quantity || 0) - 1);

      try {
        optimisticDataPersistence.save(
          'ShoppingListItem',
          itemId,
          'quantity',
          newQuantity,
        );

        await updateQuantityRef.current({
          variables: {
            itemId,
            quantity: newQuantity.toString(),
            version: fullItem.version,
          },
          optimisticResponse: {
            __typename: 'Mutation',
            updateShoppingListItemQuantity: {
              ...fullItem,
              __typename: 'ShoppingListItem',
              quantity: newQuantity,
              version: fullItem.version,
              updatedAt: new Date().toISOString(),
            },
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
            { text: 'Refresh', onPress: () => refetchItemsRef.current() },
            { text: 'Cancel', style: 'cancel' },
          ]);
          return;
        }
        console.error('Failed to update quantity:', error);
        toastService.error('Failed to update quantity');
      }
    },
    [client], // Only client dependency - stable
  );

  // Transform shopping list items for SortableShoppingList
  // PERFORMANCE: Use config-based element creation instead of creating React elements
  // OPTIMIZATION: Memoize based on structural changes only, not data changes like quantity
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
        // Use config instead of creating element (performance optimization)
        // Callbacks retrieved from ShoppingListActionsContext for stable references
        rightElementConfig: {
          type: 'counter' as const,
          quantity: item.quantity || 0,
          unit: item.unit?.symbol || item.unitName,
          itemId: item.id,
          disabled: item.isPurchased,
        },
        // Use config instead of creating element (performance optimization)
        leftElementConfig: imageUrl
          ? {
              type: 'image' as const,
              url: imageUrl,
              isPurchased: item.isPurchased,
            }
          : undefined,
      };
    });
  }, [
    // OPTIMIZATION: Only items dependency - callbacks from context are stable
    // This prevents useMemo from breaking when callback references change
    items,
  ]);

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

  const handleAddItemFromSearch = useCallback(
    async (itemName: string) => {
      if (!currentListId) {
        toastService.error('Please select a shopping list first');
        return;
      }

      Telemetry.trackEvent('add_item_from_search', {
        list_id: currentListId,
        item_name_length: itemName.trim().length,
      });

      try {
        const result = await addItem({
          itemName: itemName.trim(),
          quantity: 1,
        });

        if (result) {
          Telemetry.trackEvent('add_item_success', { source: 'search' });
          haptic.success(); // Haptic feedback on successful add
          setSearchQuery(''); // Clear search after adding
        } else {
          Telemetry.trackEvent('add_item_failed', { source: 'search' });
          haptic.error(); // Error haptic on failure
          toastService.error('Failed to add item');
        }
      } catch (error) {
        Telemetry.trackError(
          error instanceof Error ? error : 'Failed to add item from search',
          { component: 'ShoppingListMain', operation: 'addItemFromSearch' },
        );
        haptic.error(); // Error haptic on exception
        toastService.error('Failed to add item');
      }
    },
    [currentListId, addItem, setSearchQuery, haptic],
  );

  const handleTogglePurchase = useCallback(
    async (itemId: string) => {
      Telemetry.trackEvent('toggle_item_purchase', { item_id: itemId });
      try {
        haptic.selection(); // Haptic feedback on toggle
        await toggleItem(itemId);
        Telemetry.trackEvent('toggle_item_purchase_success');
      } catch (error) {
        Telemetry.trackError(
          error instanceof Error ? error : 'Failed to toggle item purchase',
          { component: 'ShoppingListMain', operation: 'togglePurchase' },
        );
        haptic.error(); // Error haptic on failure
        toastService.error('Failed to toggle item');
      }
    },
    [toggleItem, haptic],
  );

  const handleDeleteItem = async (itemId: string) => {
    Telemetry.trackEvent('delete_item', { item_id: itemId });
    try {
      haptic.warning(); // Haptic feedback on delete
      await removeItem(itemId);
      Telemetry.trackEvent('delete_item_success');
      // OPTIMIZATION: No refetch needed - removeItem updates cache via cache.modify
      // Cache automatically updates via Apollo's normalized cache
    } catch (error) {
      Telemetry.trackError(
        error instanceof Error ? error : 'Failed to delete item',
        { component: 'ShoppingListMain', operation: 'deleteItem' },
      );
      haptic.error(); // Error haptic on failure
      toastService.error('Failed to delete item');
    }
  };

  const handleClearAllPurchased = useCallback(async () => {
    const purchasedItems = items.filter((item: any) => item.isPurchased);

    if (purchasedItems.length === 0) return;

    try {
      haptic.warning(); // Haptic feedback for clear all
      // Delete all purchased items
      await Promise.all(purchasedItems.map(item => removeItem(item.id)));

      // OPTIMIZATION: No refetch needed - each removeItem updates cache via cache.modify
      // Cache automatically updates via Apollo's normalized cache
    } catch (error) {
      haptic.error(); // Error haptic on failure
      toastService.error('Failed to clear purchased items');
    }
  }, [items, removeItem, haptic]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Clear optimistic data before refetch to ensure API data is source of truth
      optimisticDataPersistence.clearType('ShoppingListItem');
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

  // Handle swipeable item closing - clear the reference
  const handleSwipeableClose = useCallback(() => {
    openSwipeableRef.current = null;
  }, []);

  // Search bar actions - conditionally show "Add" button when searching with no results

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
      });
    } else {
      rightActions.unshift({
        icon: 'add',
        onPress: handleAddItem,
        color: primaryColor,
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
    handleOpenSelector,
    searchQuery,
    sortableItems.length,
    primaryColor,
    primaryLightColor,
    colors,
  ]);

  // Use ref to track currentListId without triggering effect re-runs
  const currentListIdRef = useRef(currentListId);

  // Update ref when currentListId changes
  useEffect(() => {
    currentListIdRef.current = currentListId;
  }, [currentListId]);

  // Set up scanner button when component mounts and track screen view
  // OPTIMIZATION: Defer telemetry to not block initial render
  useEffect(() => {
    // Defer telemetry tracking - not critical for initial render
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

    // Clean up on unmount
    return () => {
      setScannerProps(undefined, false);
    };
  }, [setScannerProps, navigateTo, currentListId, items, lists.length]);

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
        customListComponent={ShoppingListTabs}
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
          onSwipeableClose: handleSwipeableClose,
        }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          <PaginationFooter
            isLoadingMore={isLoadingMore}
            hasMore={hasMore}
            loading={loading}
            itemCount={items.length}
          />
        }
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
    backgroundColor: theme.colors.primaryLight,
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
