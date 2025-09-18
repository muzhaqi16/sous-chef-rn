import React, { useMemo, useEffect } from 'react';
import { TouchableOpacity, Alert, Image, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAppNavigation } from '#hooks';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import {
  useGetShoppingListsQuery,
  useRemoveItemFromShoppingListMutation,
} from '#generated';
import { ListTemplate, SearchBarAction, BottomSheetAction } from '#components';
import { ItemSelectorWithActions } from '#components/organisms/ItemSelectorWithActions';
import {
  useShoppingListSelector,
  useBottomSheetModal,
  useShoppingListManagement,
} from '#/hooks';
import { useStore } from '#/store';
import { Icon, type IconLibrary } from '#/utils/iconUtils';

export const ShoppingListMain: React.FC = () => {
  const { navigate, navigateTo } = useAppNavigation();
  const { theme } = useUnistyles();
  const selectShoppingListSheet = useBottomSheetModal();
  const { selectedShoppingListId, setSelectedShoppingListId } = useStore();
  const [deleteItem] = useRemoveItemFromShoppingListMutation();

  const { data, refetch } = useGetShoppingListsQuery({
    fetchPolicy: 'cache-and-network',
  });

  const lists = data?.shoppingLists || [];

  // Get the default list or the first list if none is default
  const defaultList = lists.find(list => list.isDefault) || lists[0];
  const currentListId = selectedShoppingListId || defaultList?.id;
  const currentList =
    lists.find(list => list.id === currentListId) || defaultList;

  // Auto-select the default list if none is selected
  useEffect(() => {
    if (!selectedShoppingListId && defaultList?.id) {
      setSelectedShoppingListId(defaultList.id);
    }
  }, [selectedShoppingListId, defaultList?.id, setSelectedShoppingListId]);

  // Use the shopping list hook for both data and mutations to ensure consistency
  const { items, searchQuery, setSearchQuery, addItem, toggleItem } = useShoppingListManagement(currentListId);

  const selector = useShoppingListSelector({
    initialSelected: currentListId,
    onSelect: (id, item) => {
      setSelectedShoppingListId(id);
      selectShoppingListSheet.close();
    },
  });

  // Transform shopping list items to list items format - separate purchased/unpurchased and move purchased to end
  const listItems = useMemo(() => {
    const unpurchasedItems = items.filter((item: any) => !item.purchasedBy);
    const purchasedItems = items.filter((item: any) => !!item.purchasedBy);

    // Sort each group by createdAt date (newest first)
    const sortByDateDesc = (a: any, b: any) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA; // Newest first
    };

    const sortedUnpurchasedItems = unpurchasedItems.sort(sortByDateDesc);
    const sortedPurchasedItems = purchasedItems.sort(sortByDateDesc);

    // Combine unpurchased first, then purchased
    const sortedItems = [...sortedUnpurchasedItems, ...sortedPurchasedItems];

    return sortedItems.map((item: any) => ({
      id: item.id,
      title: item.itemName,
      subtitle: `${item.quantity} ${item.unitName || ''}`.trim(),
      rightElement: (
        <TouchableOpacity
          style={[styles.checkbox, item.purchasedBy && styles.checkboxChecked]}
          onPress={() => toggleItem(item.id)}>
          {item.purchasedBy && <Icon name="check" size={16} color="white" />}
        </TouchableOpacity>
      ),
      // show image on the left if available
      leftElement: item.item.imageUrl ? (
        <View style={styles.imageContainer}>
          <Image source={{ uri: item.item.imageUrl }} style={styles.leftImage} />
        </View>
      ) : null,
      // Add visual styling for purchased items
      style: item.purchasedBy ? { opacity: 0.6 } : undefined,
    }));
  }, [items, toggleItem]);

  const handleAddItem = () => {
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
  };

  const handleAddItemFromSearch = async (itemName: string) => {
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
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await deleteItem({ variables: { id: itemId } });
    } catch (error) {
      Alert.alert('Error', 'Failed to delete item');
    }
  };

  // Search bar actions - conditionally show "Add" button when searching with no results
  const searchBarActions = useMemo(() => {
    const hasSearchWithNoResults = searchQuery.trim() && listItems.length === 0;

    const rightActions: SearchBarAction[] = [
      {
        icon: 'list',
        color: '#fff',
        onPress: () => selectShoppingListSheet.open(),
      },
    ];

    // Add the "Add item from search" button when searching with no results
    if (hasSearchWithNoResults) {
      rightActions.unshift({
        icon: 'add',
        onPress: () => handleAddItemFromSearch(searchQuery),
        color: theme.colors.primary,
        backgroundColor: theme.colors.primaryLight,
      });
    } else {
      // Show regular add button when not searching
      rightActions.unshift({
        icon: 'add',
        onPress: handleAddItem,
        color: theme.colors.primary,
        backgroundColor: 'white',
      });
    }

    return {
      left: [] as SearchBarAction[],
      right: rightActions,
    };
  }, [handleAddItem, handleAddItemFromSearch, searchQuery, listItems.length]);

  const handleRefresh = async () => {
    await Promise.all([refetch()]);
  };
  // Refetch data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      refetch();
    }, [refetch]),
  );

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

  return (
    <>
      <ListTemplate
        title={currentList?.name || 'Shopping List'}
        subtitle="Shopping List"
        items={listItems}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onItemPress={id =>
          navigate('EditItem', { listId: currentListId, itemId: id })
        }
        onItemEdit={id =>
          navigate('EditItem', { listId: currentListId, itemId: id })
        }
        onItemDelete={handleDeleteItem}
        onRefresh={handleRefresh}
        // Display configuration
        showSearchBar={true}
        showFAB={true}
        onFabPress={() =>
          navigateTo.barcode({ source: 'shoppingList', shoppingListId: currentListId })
        }
        // Actions
        searchBarActions={searchBarActions}
        emptyState={
          searchQuery.trim()
            ? undefined // No empty state during search - user can add via search bar button
            : {
              icon: 'add-shopping-cart',
              title: 'No items in this list',
              description: 'Add items to your shopping list',
              action: {
                label: 'Add first item',
                onPress: handleAddItem,
              },
            }
        }
      />

      <BottomSheetAction
        key={'select-list'}
        sheetRef={selectShoppingListSheet.ref}
        sheetTitle={'Select Shopping List'}
        snapPoints={['50%', '90%']}>
        <ItemSelectorWithActions
          data={selector.data}
          selectedId={selector.selectedId}
          onSelect={selector.handleSelect}
          displayProperty="name"
          loading={selector.loading}
          emptyMessage={selector.emptyMessage}
          actions={[
            {
              icon: 'add',
              label: 'Create New List',
              onPress: () => {
                selectShoppingListSheet.close();
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
                    selectShoppingListSheet.close();
                    navigate('ShareList', { listId: currentListId });
                  },
                  iconLibrary: 'MaterialIcons' as IconLibrary,
                },
                {
                  icon: 'settings',
                  label: 'List Settings',
                  onPress: () => {
                    selectShoppingListSheet.close();
                    navigate('ListSettings', {
                      listId: currentListId,
                    });
                  },
                  iconLibrary: 'MaterialIcons' as IconLibrary,
                },
              ]
              : []),
          ]}
        />
      </BottomSheetAction>
    </>
  );
};

const styles = StyleSheet.create(theme => ({
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
    padding: 16,
    marginTop: 8,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
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
