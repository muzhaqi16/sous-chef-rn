// src/screens/shoppingList/ShoppingListMainV2.tsx
import React, {useState, useMemo} from 'react';
import {
  View,
  SectionList,
  Text,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {
  useGetShoppingListsQuery,
  useAddItemToShoppingListMutation,
  useMarkItemPurchasedMutation,
  useUpdateShoppingListItemMutation,
  useRemoveItemFromShoppingListMutation,
} from '#generated';
import {SmartSearchAddBar} from '#components/molecules/SmartSearchAddBar';
import {ShoppingListItem} from '#components/molecules/ShoppingListItem';
import {QuickAddBar} from '#components/molecules/QuickAddBar';
import {UserHeader} from '#components';
import {useStore} from '#store';

export const ShoppingListMainV2: React.FC = () => {
  const {theme} = useUnistyles();
  const [searchQuery, setSearchQuery] = useState('');
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const {selectedShoppingListId} = useStore();

  const {data, refetch} = useGetShoppingListsQuery();
  const [addItem] = useAddItemToShoppingListMutation();
  const [toggleItem] = useMarkItemPurchasedMutation();
  const [updateItem] = useUpdateShoppingListItemMutation();
  const [deleteItem] = useRemoveItemFromShoppingListMutation();

  const currentList = data?.shoppingLists?.find(
    list => list.id === selectedShoppingListId,
  );

  const items = currentList?.items || [];

  // Split and group items
  const sections = useMemo(() => {
    const unpurchased = items.filter((item: any) => !item.isPurchased);
    const purchased = items.filter((item: any) => item.isPurchased);

    const filtered = (list: any[]) => {
      if (!searchQuery) return list;
      return list.filter((item: any) =>
        item.itemName.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    };

    const result = [];

    if (filtered(unpurchased).length > 0) {
      result.push({
        title: 'To Buy',
        data: filtered(unpurchased),
      });
    }

    if (filtered(purchased).length > 0) {
      result.push({
        title: 'Purchased',
        data: filtered(purchased),
        collapsed: true,
      });
    }

    return result;
  }, [items, searchQuery]);

  const handleAddItem = async (item: {name: string; quantity: number}) => {
    if (!selectedShoppingListId) {
      Alert.alert('Error', 'Please select a shopping list first');
      return;
    }

    try {
      await addItem({
        variables: {
          input: {
            shoppingListId: selectedShoppingListId,
            itemName: item.name,
            quantity: item.quantity,
          },
        },
      });
      setSearchQuery('');
    } catch (error) {
      Alert.alert('Error', 'Failed to add item');
    }
  };

  const handleToggleItem = async (itemId: string) => {
    const item = items.find((i: any) => i.id === itemId);
    if (item) {
      await toggleItem({
        variables: {
          id: itemId,
          status: !item.isPurchased,
        },
      });
    }
  };

  const handleUpdateQuantity = async (itemId: string, quantity: number) => {
    await updateItem({
      variables: {
        id: itemId,
        input: {quantity},
      },
    });
  };

  const renderSectionHeader = ({section}: any) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      <Text style={styles.sectionCount}>{section.data.length} items</Text>
    </View>
  );

  const renderItem = ({item}: any) => (
    <ShoppingListItem
      id={item.id}
      name={item.itemName}
      quantity={item.quantity}
      unit={item.unitName}
      imageUrl={item.item?.imageUrl}
      isPurchased={item.isPurchased}
      onToggle={handleToggleItem}
      onUpdateQuantity={handleUpdateQuantity}
      onDelete={async id => {
        await deleteItem({variables: {id}});
      }}
      onEdit={id => {
        // Optional: Navigate to edit screen or show inline edit
      }}
    />
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <UserHeader />

      <SmartSearchAddBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        onAddItem={handleAddItem}
        placeholder="Search or add items..."
      />

      <QuickAddBar visible={showQuickAdd} onAddItem={handleAddItem} />

      <SectionList
        sections={sections}
        keyExtractor={(item: any) => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchQuery
                ? `No items found for "${searchQuery}"`
                : 'Your shopping list is empty'}
            </Text>
            {searchQuery && (
              <TouchableOpacity
                style={styles.addNewButton}
                onPress={() => handleAddItem({name: searchQuery, quantity: 1})}>
                <Text style={styles.addNewText}>
                  Add "{searchQuery}" to list
                </Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  listContent: {
    paddingBottom: 100,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.background,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  sectionCount: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  separator: {
    height: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginBottom: 16,
  },
  addNewButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: theme.colors.primary,
    borderRadius: 20,
  },
  addNewText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
}));
