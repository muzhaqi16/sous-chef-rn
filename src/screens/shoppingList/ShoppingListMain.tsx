import React, { useMemo, useEffect, useCallback, useRef } from 'react';
import { TouchableOpacity, Alert, Image, View } from 'react-native';
import { useAppNavigation } from '#hooks';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import {
  useGetShoppingListsQuery,
  useRemoveItemFromShoppingListMutation,
  useReorderShoppingListItemsMutation,
} from '#generated';
import { useScanner } from '#context';
import {
  ListTemplate,
  SearchBarAction,
  AnimatedItemSelector,
  SortableShoppingList,
  SearchBar,
  UserHeader,
  EmptyState,
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
import { Icon, IconLibrary } from '#/utils/iconUtils';

export const ShoppingListMain: React.FC = () => {
  const { navigate, navigateTo } = useAppNavigation();
  const {
    theme: { colors },
  } = useUnistyles();
  const { primary: primaryColor, primaryLight: primaryLightColor } = colors;
  // Step 2: Use the extracted variables INSIDE useMemo
  const { selectedShoppingListId, setSelectedShoppingListId } = useStore();
  const selectorRef = useRef<ItemSelectorRef>(null);
  const { setScannerProps } = useScanner();
  const [deleteItem] = useRemoveItemFromShoppingListMutation();
  const [reorderItems] = useReorderShoppingListItemsMutation();

  const { data, refetch } = useGetShoppingListsQuery({
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
  const { items, searchQuery, setSearchQuery, addItem, toggleItem } =
    useShoppingListManagement(currentListId);

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

  // Transform shopping list items for display - simple like pantry
  const listItems = useMemo(() => {
    // Use isPurchased field as primary source of truth
    const unpurchasedItems = items.filter((item: any) => !item.isPurchased);
    const purchasedItems = items.filter((item: any) => item.isPurchased);

    // Sort each group by sortOrder (ascending - lowest sortOrder first)
    const sortBySortOrder = (a: any, b: any) => {
      // Handle missing sortOrder values defensively
      const aOrder = a.sortOrder ?? 999999; // Default high value for items without sortOrder
      const bOrder = b.sortOrder ?? 999999; // Default high value for items without sortOrder
      return aOrder - bOrder;
    };

    const sortedUnpurchasedItems = unpurchasedItems.sort(sortBySortOrder);
    const sortedPurchasedItems = purchasedItems.sort(sortBySortOrder);

    // Combine unpurchased first, then purchased
    const sortedItems = [...sortedUnpurchasedItems, ...sortedPurchasedItems];

    return sortedItems.map((item: any) => ({
      id: item.id,
      title: item.itemName,
      subtitle: `${item.quantity} ${item.unitName || ''}`.trim(),
      badge: item.isPurchased
        ? { text: 'Purchased', variant: 'success' }
        : undefined,
      rightElement: (
        <TouchableOpacity
          style={[styles.checkbox, item.isPurchased && styles.checkboxChecked]}
          onPress={() => toggleItem(item.id)}
        >
          {item.isPurchased && <Icon name="check" size={16} color="white" />}
        </TouchableOpacity>
      ),
      // show image on the left if available
      leftElement: item.item?.imageUrl ? (
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: item.item.imageUrl }}
            style={styles.leftImage}
          />
        </View>
      ) : null,
    }));
  }, [items, toggleItem]);

  // Transform shopping list items for SortableShoppingList
  const sortableItems = useMemo((): SortableShoppingListItem[] => {
    // Use isPurchased field as primary source of truth
    const unpurchasedItems = items.filter((item: any) => !item.isPurchased);
    const purchasedItems = items.filter((item: any) => item.isPurchased);

    // Sort each group by sortOrder (ascending - lowest sortOrder first)
    const sortBySortOrder = (a: any, b: any) => {
      // Handle missing sortOrder values defensively
      const aOrder = a.sortOrder ?? 999999; // Default high value for items without sortOrder
      const bOrder = b.sortOrder ?? 999999; // Default high value for items without sortOrder
      return aOrder - bOrder;
    };

    const sortedUnpurchasedItems = unpurchasedItems.sort(sortBySortOrder);
    const sortedPurchasedItems = purchasedItems.sort(sortBySortOrder);

    // Combine unpurchased first, then purchased
    const sortedItems = [...sortedUnpurchasedItems, ...sortedPurchasedItems];

    return sortedItems.map((item: any) => ({
      id: item.id,
      title: item.itemName,
      subtitle: `${item.quantity} ${item.unitName || ''}`.trim(),
      sortOrder: item.sortOrder ?? 0,
      isPurchased: item.isPurchased,
      badge: item.isPurchased
        ? { text: 'Purchased', variant: 'success' }
        : undefined,
      rightElement: (
        <TouchableOpacity
          style={[styles.checkbox, item.isPurchased && styles.checkboxChecked]}
          onPress={() => toggleItem(item.id)}
        >
          {item.isPurchased && <Icon name="check" size={16} color="white" />}
        </TouchableOpacity>
      ),
      leftElement: item.item?.imageUrl ? (
        <View style={styles.imageContainer}>
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
      await deleteItem({ variables: { id: itemId } });
    } catch (error) {
      Alert.alert('Error', 'Failed to delete item');
    }
  };

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
        });
      } catch (error) {
        console.error('Failed to update sort order:', error);
        Alert.alert('Error', 'Failed to reorder items');
      }
    },
    [currentListId, reorderItems],
  );

  // Search bar actions - conditionally show "Add" button when searching with no results

  const searchBarActions = useMemo(() => {
    const hasSearchWithNoResults = searchQuery.trim() && listItems.length === 0;
    const rightActions: SearchBarAction[] = [
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
    searchQuery,
    listItems.length,
    primaryColor, // ← Include extracted variable in deps
    primaryLightColor, // ← Include extracted variable in deps
  ]);
  const handleRefresh = async () => {
    await Promise.all([refetch()]);
  };

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
    return (
      <ListTemplate
        showHeader={true}
        emptyState={{
          icon: 'add-shopping-cart',
          title: 'No shopping lists',
          description: 'Create a shopping list to get started',
          action: {
            label: 'Create List',
            onPress: () => navigate('ListSettings'),
          },
        }}
      />
    );
  }

  // Always render the same SearchBar to prevent TextInput remounting
  return (
    <View style={styles.container}>
      <UserHeader />

      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search shopping list..."
        leftActions={searchBarActions.left || []}
        rightActions={searchBarActions.right || []}
        listName={currentList?.name || 'Shopping List'}
        itemCount={sortableItems.length}
        completedCount={sortableItems.filter(item => item.isPurchased).length}
      />

      {/* Conditional content based on search state */}
      {searchQuery.trim() ? (
        // Show search results using ListTemplate without search bar and user header
        <ListTemplate
          title={currentList?.name || 'Shopping List'}
          subtitle="Shopping List"
          items={listItems}
          onItemPress={id =>
            navigate('EditItem', { listId: currentListId, itemId: id })
          }
          onItemEdit={id =>
            navigate('EditItem', { listId: currentListId, itemId: id })
          }
          onItemDelete={handleDeleteItem}
          onRefresh={handleRefresh}
          showSearchBar={false} // Don't show search bar since we have one above
          showUserHeader={false} // Don't show user header since we have one above
        />
      ) : listItems.length === 0 ? (
        // Show empty state
        <EmptyState
          icon="add-shopping-cart"
          title="No items in this list"
          description="Add some items to get started"
          action={{
            label: 'Add Item',
            onPress: handleAddItem,
          }}
        />
      ) : (
        // Show sortable list with drag-and-drop
        <SortableShoppingList
          items={sortableItems}
          onItemPress={id =>
            navigate('EditItem', { listId: currentListId, itemId: id })
          }
          onItemEdit={id =>
            navigate('EditItem', { listId: currentListId, itemId: id })
          }
          onItemDelete={handleDeleteItem}
          onSortOrderUpdate={handleSortOrderUpdate}
          groupByPurchased={true}
          showsVerticalScrollIndicator={true}
        />
      )}

      <AnimatedItemSelector
        ref={selectorRef}
        config={listConfig}
        maxHeight={600}
      />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  actionButtonText: {
    marginLeft: 12,
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  imageContainer: {
    width: 60,
    height: 60,
    marginRight: 16,
    borderRadius: 8,
    overflow: 'hidden',
    alignContent: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  leftImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    resizeMode: 'cover',
    elevation: 2,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
}));
