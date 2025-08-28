import React, {useMemo} from 'react';
import {TouchableOpacity, Text, Alert, Image, View} from 'react-native';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {
  useGetShoppingListsQuery,
  useMarkItemPurchasedMutation,
  useRemoveItemFromShoppingListMutation,
} from '#generated';
import {ShoppingListMainNavProp} from '#navigation/types';
import {
  ListTemplate,
  SearchBarAction,
  BottomSheetAction,
  ItemSelector,
  EmptyState,
} from '#components';
import {
  useShoppingListSelector,
  useBottomSheetModal,
  useShoppingList,
} from '#/hooks';
import {useStore} from '#/store';
import {Icon} from '#/utils/iconUtils';

export const ShoppingListMain: React.FC = () => {
  const {theme} = useUnistyles();
  const navigation = useNavigation<ShoppingListMainNavProp>();
  const selectShoppingListSheet = useBottomSheetModal();
  const {selectedShoppingListId, setSelectedShoppingListId} = useStore();
  const [toggleItem] = useMarkItemPurchasedMutation();
  const [deleteItem] = useRemoveItemFromShoppingListMutation();

  const {data, refetch} = useGetShoppingListsQuery({
    fetchPolicy: 'cache-and-network',
  });

  const lists = data?.shoppingLists || [];

  // Get the default list or the first list if none is default
  const defaultList = lists.find(list => list.isDefault) || lists[0];
  const currentListId = selectedShoppingListId || defaultList?.id;
  const currentList =
    lists.find(list => list.id === currentListId) || defaultList;

  const {items, query, setQuery} = useShoppingList(currentListId);

  const selector = useShoppingListSelector({
    initialSelected: currentListId,
    onSelect: (id, item) => {
      setSelectedShoppingListId(id);
      selectShoppingListSheet.close();
    },
  });

  // Transform shopping list items to list items format
  const listItems = useMemo(() => {
    return items.map((item: any) => ({
      id: item.id,
      title: item.itemName,
      subtitle: `${item.quantity} ${item.unitName || ''}`.trim(),
      rightElement: (
        <TouchableOpacity
          style={[styles.checkbox, item.isPurchased && styles.checkboxChecked]}
          onPress={() =>
            toggleItem({variables: {id: item.id, status: !item.isPurchased}})
          }>
          {item.isPurchased && <Icon name="check" size={16} color="white" />}
        </TouchableOpacity>
      ),
      // show image on the left if available
      leftElement: item.item.imageUrl ? (
        <View style={styles.imageContainer}>
          <Image source={{uri: item.item.imageUrl}} style={styles.leftImage} />
        </View>
      ) : null,
    }));
  }, [items, toggleItem]);

  const handleAddItem = () => {
    if (!currentListId) {
      Alert.alert(
        'No List Selected',
        'Please select or create a shopping list first.',
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Create List',
            onPress: () => navigation.navigate('ListSettings'),
          },
        ],
      );
      return;
    }
    navigation.navigate('AddItem', {listId: currentListId});
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await deleteItem({variables: {id: itemId}});
    } catch (error) {
      Alert.alert('Error', 'Failed to delete item');
    }
  };

  // Search bar actions - similar to PantryMain
  const searchBarActions = useMemo(
    () => ({
      left: [] as SearchBarAction[],
      right: [
        {
          icon: 'list',
          color: '#fff',
          onPress: () => selectShoppingListSheet.open(),
        },
        {
          icon: 'add',
          onPress: handleAddItem,
          color: '#fff',
        },
      ] as SearchBarAction[],
    }),
    [handleAddItem],
  );

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
      <EmptyState
        icon="shopping-cart"
        title="No Shopping Lists"
        description="Create your first shopping list to get started."
        action={{
          label: 'Create your first list',
          onPress: () => navigation.navigate('ListSettings', {listId: ''}),
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
        searchQuery={query}
        onSearchChange={setQuery}
        onItemPress={id =>
          navigation.navigate('EditItem', {listId: currentListId, itemId: id})
        }
        onItemEdit={id =>
          navigation.navigate('EditItem', {listId: currentListId, itemId: id})
        }
        onItemDelete={handleDeleteItem}
        onRefresh={handleRefresh}
        // Display configuration
        showSearchBar={true}
        showFAB={false} // Don't show FAB since we have add in search bar
        // Actions
        searchBarActions={searchBarActions}
        emptyState={{
          icon: 'add-shopping-cart',
          title: 'No items in this list',
          description: 'Add items to your shopping list',
          action: {
            label: 'Add first item',
            onPress: handleAddItem,
          },
        }}
      />

      <BottomSheetAction
        key={'select-list'}
        sheetRef={selectShoppingListSheet.ref}
        sheetTitle={'Select Shopping List'}
        snapPoints={['50%', '90%']}>
        <ItemSelector
          data={selector.data}
          selectedId={selector.selectedId}
          onSelect={selector.handleSelect}
          displayProperty="name"
          loading={selector.loading}
          emptyMessage={selector.emptyMessage}
        />

        {/* Action buttons for list management */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            navigation.navigate('ListSettings');
          }}>
          <Icon name="add" size={20} color={theme.colors.primary} />
          <Text style={styles.actionButtonText}>Create New List</Text>
        </TouchableOpacity>

        {currentListId && (
          <>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                selectShoppingListSheet.close();
                navigation.navigate('ShareList', {listId: currentListId});
              }}>
              <Icon name="share" size={20} color={theme.colors.primary} />
              <Text style={styles.actionButtonText}>Share Current List</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                selectShoppingListSheet.close();
                navigation.navigate('ListSettings', {listId: currentListId});
              }}>
              <Icon name="settings" size={20} color={theme.colors.primary} />
              <Text style={styles.actionButtonText}>List Settings</Text>
            </TouchableOpacity>
          </>
        )}
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
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
}));
