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
  useReorderShoppingListItemsMutation,
} from '#generated';
import { useScanner } from '#context';
import {
  SearchBarAction,
  AnimatedItemSelector,
  SortableShoppingList,
  EmptyState,
  ListTemplate,
} from '#components';
import type {
  SelectorConfig,
  ItemSelectorRef,
} from '#components/organisms/AnimatedItemSelector';
import type {
  SortableShoppingListItem,
  SortOrderUpdate,
} from '#components/organisms/SortableShoppingList';
import { useShoppingListManagement } from '#/hooks';
import { useStore } from '#/store';
import { IconLibrary } from '#/utils/iconUtils';
import { AnimatedCheckbox } from '#/components/atoms/AnimatedCheckbox';

// Wrapper component that conditionally renders EmptyState or SortableShoppingList
const ShoppingListContent: React.FC<{
  items: SortableShoppingListItem[];
  onItemPress: (id: string) => void;
  onItemEdit?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  onSortOrderUpdate?: (updates: SortOrderUpdate[]) => Promise<void>;
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
  disabled?: boolean;
  emptyState?: any;
}> = ({
  items,
  onItemPress,
  onItemEdit,
  onItemDelete,
  onSortOrderUpdate,
  onRefresh,
  refreshing,
  disabled,
  emptyState,
}) => {
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
    <View style={{ flex: 1 }}>
      <SortableShoppingList
        items={items}
        onItemPress={onItemPress}
        onItemEdit={onItemEdit}
        onItemDelete={onItemDelete}
        onSortOrderUpdate={onSortOrderUpdate}
        disabled={disabled}
        showsVerticalScrollIndicator={true}
      />
    </View>
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
  const [reorderItems] = useReorderShoppingListItemsMutation();
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
    async (updates: SortOrderUpdate[]) => {
      if (!currentListId) return;

      try {
        await reorderItems({
          variables: {
            input: {
              shoppingListId: currentListId,
              items: updates.map(update => ({
                id: update.id,
                sortOrder: update.sortOrder,
              })),
            },
          },
          errorPolicy: 'all', // Allow offline mutations
          // Update cache immediately to prevent flicker
          update: (cache, { data }) => {
            if (!data?.reorderShoppingListItems) return;

            try {
              // Update each item's sortOrder in the cache
              data.reorderShoppingListItems.forEach(item => {
                const itemCacheId = cache.identify({
                  __typename: 'ShoppingListItem',
                  id: item.id,
                });

                if (itemCacheId) {
                  cache.modify({
                    id: itemCacheId,
                    fields: {
                      sortOrder() {
                        return item.sortOrder;
                      },
                    },
                  });
                }
              });
            } catch (cacheError) {
              console.warn('Cache update failed for reorder:', cacheError);
              // Don't throw - mutation succeeded, cache update is optional
            }
          },
        });
      } catch (error) {
        console.error('Failed to update sort order:', error);
        Alert.alert('Error', 'Failed to reorder items');
      }
    },
    [currentListId, reorderItems],
  );

  // Transform shopping list items for SortableShoppingList
  const sortableItems = useMemo((): SortableShoppingListItem[] => {
    // Group items by isPurchased status and sort within each group
    const sortBySortOrder = (a: any, b: any) => {
      const aOrder = a.sortOrder ?? 999999;
      const bOrder = b.sortOrder ?? 999999;
      return aOrder - bOrder;
    };

    const unpurchasedItems = items
      .filter((item: any) => !item.isPurchased)
      .sort(sortBySortOrder);
    const purchasedItems = items
      .filter((item: any) => item.isPurchased)
      .sort(sortBySortOrder);

    const sortedItems = [...unpurchasedItems, ...purchasedItems];

    return sortedItems.map((item: any) => ({
      id: item.id,
      title: item.itemName,
      subtitle: `${item.quantity} ${item.unitName || ''}`.trim(),
      sortOrder: item.sortOrder ?? 0,
      isPurchased: item.isPurchased,
      badge: undefined,
      rightElement: (
        <AnimatedCheckbox
          checked={item.isPurchased}
          onPress={() => toggleItem(item.id)}
          size={24}
        />
      ),
      leftElement: item.item?.imageUrl ? (
        <View
          style={[styles.imageContainer, item.isPurchased && { opacity: 0.5 }]}
        >
          <Image
            source={{ uri: item.item.imageUrl }}
            style={styles.leftImage}
          />
        </View>
      ) : null,
    }));
  }, [items, toggleItem]);

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
          onRefresh: handleRefresh,
          refreshing,
          disabled: !!searchQuery.trim(),
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
  imageContainer: {
    width: theme.sizes.listImage.width,
    height: theme.sizes.listImage.height,
    marginRight: theme.spacing.md,
    borderRadius: theme.radii.md,
    overflow: 'hidden',
    alignContent: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.primary,
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 1,
        blurRadius: 1.41,
        spreadDistance: 0,
        color: '#00000024',
      },
    ],
  },
  leftImage: {
    width: theme.sizes.listImage.width,
    height: theme.sizes.listImage.height,
    borderRadius: theme.radii.md,
    resizeMode: 'cover',
  },
}));
