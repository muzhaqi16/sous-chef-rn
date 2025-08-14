import React, {useState, useEffect} from 'react';
import {View, ActivityIndicator, Text} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import {
  SearchBar,
  ShoppingListSelector,
  AddItemBottomSheet,
  ItemDetailBottomSheet,
  BottomSheetAction,
} from '#components';
import {useStore} from '#store';
import {useBottomSheetModal} from '#hooks';
import {
  useGetShoppingListQuery,
  useGetShoppingListsQuery,
  useAddItemToShoppingListMutation,
  useRemoveItemFromShoppingListMutation,
  useToggleShoppingListItemCompletionMutation,
  useUpdateShoppingListItemMutation,
} from '#generated';
import {UserHeader} from '#components/molecules/UserHeader';
import {ShoppingListItemDetail} from '../../types';

export const ShoppingListScreen: React.FC = () => {
  const {styles, theme} = useStyles(stylesheet);
  const {selectedShoppingListId, setSelectedShoppingListId} = useStore();
  const [query, setQuery] = useState('');
  const [detailItem, setDetailItem] = useState<ShoppingListItemDetail | null>(
    null,
  );

  // GraphQL Queries
  const {
    data: shoppingListData,
    loading: listLoading,
    error: listError,
    refetch: refetchList,
  } = useGetShoppingListQuery({
    variables: {id: selectedShoppingListId || ''},
    skip: !selectedShoppingListId,
    fetchPolicy: 'cache-and-network',
  });

  const {
    data: allListsData,
    loading: allListsLoading,
    refetch: refetchAllLists,
  } = useGetShoppingListsQuery({
    fetchPolicy: 'cache-first',
  });

  // GraphQL Mutations
  const [addItem] = useAddItemToShoppingListMutation({
    onCompleted: () => {
      refetchList();
      addSheet.close();
    },
    onError: error => {
      console.error('Error adding item:', error);
    },
  });

  const [removeItem] = useRemoveItemFromShoppingListMutation({
    onCompleted: () => {
      refetchList();
    },
    onError: error => {
      console.error('Error removing item:', error);
    },
  });

  const [toggleItemCompletion] = useToggleShoppingListItemCompletionMutation({
    onCompleted: () => {
      refetchList();
    },
    onError: error => {
      console.error('Error toggling item:', error);
    },
  });

  const [updateItem] = useUpdateShoppingListItemMutation({
    onCompleted: () => {
      refetchList();
      detailSheet.close();
    },
    onError: error => {
      console.error('Error updating item:', error);
    },
  });

  // Bottom sheet refs
  const selectSheet = useBottomSheetModal();
  const addSheet = useBottomSheetModal();
  const detailSheet = useBottomSheetModal();

  // Filter items based on search query
  const filteredItems = React.useMemo(() => {
    if (!shoppingListData?.shoppingList?.items) return [];

    const items = shoppingListData.shoppingList.items;

    if (!query.trim()) return items;

    const searchTerm = query.toLowerCase();
    return items.filter((item: any) => {
      const itemName = item.itemName || item.item?.name || '';
      const notes = item.notes || '';
      const category = item.category || '';

      return (
        itemName.toLowerCase().includes(searchTerm) ||
        notes.toLowerCase().includes(searchTerm) ||
        category.toLowerCase().includes(searchTerm)
      );
    });
  }, [shoppingListData, query]);

  // Set default shopping list if none selected
  useEffect(() => {
    if (
      !selectedShoppingListId &&
      (allListsData?.shoppingLists?.length ?? 0) > 0
    ) {
      const defaultList = allListsData?.shoppingLists?.find(
        (list: any) => list.isDefault,
      );
      const listToUse = defaultList || allListsData?.shoppingLists?.[0];
      if (listToUse?.id) {
        setSelectedShoppingListId(listToUse.id);
      }
    }
  }, [allListsData, selectedShoppingListId, setSelectedShoppingListId]);

  const handleAddItem = async (itemData: any) => {
    if (!selectedShoppingListId) return;

    await addItem({
      variables: {
        input: {
          shoppingListId: selectedShoppingListId,
          itemId: itemData.itemId,
          itemName: itemData.itemName || itemData.name,
          quantity: itemData.quantity || 1,
          unitId: itemData.unitId,
          unitName: itemData.unitName,
          estimatedPrice: itemData.estimatedPrice,
          notes: itemData.notes,
          category: itemData.category,
          priority: itemData.priority || 0,
        },
      },
    });
  };

  const handleRemoveItem = async (itemId: string) => {
    await removeItem({
      variables: {
        id: itemId,
      },
    });
  };

  const handleToggleItem = async (itemId: string) => {
    await toggleItemCompletion({
      variables: {
        id: itemId,
      },
    });
  };

  const handleUpdateItem = async (itemId: string, updates: any) => {
    await updateItem({
      variables: {
        id: itemId,
        input: updates,
      },
    });
  };

  const onItemPress = (item: ShoppingListItemDetail) => {
    setDetailItem(item);
    detailSheet.open();
  };

  const bottomSheets = [
    {
      key: 'select',
      sheet: selectSheet,
      title: 'Select Shopping List',
      snapPoints: ['25%', '50%', '90%'],
      content: (
        <ShoppingListSelector
          onSelect={(id: string) => {
            setSelectedShoppingListId(id);
            selectSheet.close();
          }}
        />
      ),
    },
    {
      key: 'add',
      sheet: addSheet,
      title: 'Add Item',
      snapPoints: ['50%', '90%'],
      content: (
        <AddItemBottomSheet
          onAddItem={handleAddItem}
          onGoToDetails={(item: any) => {
            addSheet.close();
            setTimeout(() => {
              setDetailItem(item);
              detailSheet.open();
            }, 200);
          }}
        />
      ),
    },
  ];

  if (listLoading && !shoppingListData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (listError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Error loading shopping list</Text>
        <Text style={styles.errorSubtext}>{listError.message}</Text>
      </View>
    );
  }

  const currentList = shoppingListData?.shoppingList;

  return (
    <View style={styles.container}>
      <UserHeader />

      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="Search items…"
        onPressList={() => selectSheet.open()}
        onPressAdd={() => addSheet.open()}
        listName={currentList?.name}
        itemCount={currentList?.items?.length || 0}
        completedCount={
          currentList?.items?.filter((item: any) => item.isPurchased).length ||
          0
        }
      />

      {bottomSheets.map(({key, sheet, title, snapPoints, content}) => (
        <BottomSheetAction
          key={key}
          sheetRef={sheet.ref}
          sheetTitle={title}
          snapPoints={snapPoints}>
          {content}
        </BottomSheetAction>
      ))}

      {detailItem && (
        <BottomSheetAction
          sheetRef={detailSheet.ref}
          sheetTitle="Item Details"
          snapPoints={['45%', '65%']}>
          <ItemDetailBottomSheet
            item={detailItem}
            onClose={detailSheet.close}
            onUpdate={(updates: any) => {
              if (detailItem.id) {
                handleUpdateItem(detailItem.id, updates);
              }
            }}
            onRemove={() => {
              if (detailItem.id) {
                handleRemoveItem(detailItem.id);
                detailSheet.close();
              }
            }}
          />
        </BottomSheetAction>
      )}
    </View>
  );
};

const stylesheet = createStyleSheet(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.error || 'red',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary || '#666',
    textAlign: 'center',
  },
}));

export default ShoppingListScreen;
