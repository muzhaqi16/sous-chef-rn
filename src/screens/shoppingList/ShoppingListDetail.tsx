import React, {useMemo, useState, useEffect} from 'react';
import {TouchableOpacity, TextInput, View, Alert} from 'react-native';
import Icon from '@react-native-vector-icons/material-icons';
import {useNavigation, useRoute} from '@react-navigation/native';
import {useStyles, createStyleSheet} from 'react-native-unistyles';
import {
  useCreateShoppingListMutation,
  useUpdateShoppingListMutation,
  useToggleShoppingListItemCompletionMutation,
} from '#generated';
import {ShoppingListDetailNavProp} from '#navigation/types';
import {ListTemplate} from '#components/templates/ListTemplate';
import {Header} from '#components/molecules/Header';
import {useShoppingListDetails} from '#/hooks';

export const ShoppingListDetail: React.FC = () => {
  const {styles, theme} = useStyles(detailStyles);
  const navigation = useNavigation<ShoppingListDetailNavProp>();
  const route = useRoute();
  const {listId} = route.params as {listId: string};
  const isNew = listId === 'new';

  const [name, setName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditing, setIsEditing] = useState(isNew);

  const {shoppingList, refetch} = useShoppingListDetails(listId);

  const [createList] = useCreateShoppingListMutation();
  const [updateList] = useUpdateShoppingListMutation();
  const [toggleItem] = useToggleShoppingListItemCompletionMutation();

  useEffect(() => {
    if (shoppingList) {
      setName(shoppingList.name);
    }
  }, [shoppingList]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a list name');
      return;
    }

    try {
      if (isNew) {
        const result = await createList({
          variables: {input: {name, isDefault: false}},
        });
        if (result.data?.createShoppingList) {
          navigation.setParams({listId: result.data.createShoppingList.id});
        }
      } else {
        await updateList({
          variables: {id: listId, input: {name}},
        });
      }
      setIsEditing(false);
      refetch();
    } catch (error) {
      Alert.alert('Error', 'Failed to save list');
    }
  };

  const items = useMemo(() => {
    const allItems = (shoppingList?.items || []).map((item: any) => ({
      id: item.id,
      title: item.itemName,
      subtitle: `${item.quantity} ${item.unitName || ''}`.trim(),
      rightElement: (
        <TouchableOpacity
          style={[styles.checkbox, item.isPurchased && styles.checkboxChecked]}
          onPress={() => toggleItem({variables: {id: item.id}})}>
          {item.isPurchased && <Icon name="check" size={16} color="white" />}
        </TouchableOpacity>
      ),
    }));

    if (!searchQuery) return allItems;

    return allItems.filter(item =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [shoppingList, searchQuery, toggleItem]);

  if (isEditing) {
    return (
      <View style={styles.container}>
        <Header
          title={isNew ? 'New List' : 'Edit List'}
          onBack={() => navigation.goBack()}
          actions={[
            {
              icon: 'check',
              onPress: handleSave,
            },
          ]}
        />
        <View style={styles.editForm}>
          <TextInput
            style={styles.nameInput}
            value={name}
            onChangeText={setName}
            placeholder="List name"
            autoFocus
          />
        </View>
      </View>
    );
  }

  return (
    <ListTemplate
      title={name || 'Shopping List'}
      items={items}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      onItemPress={id => navigation.navigate('EditItem', {listId, itemId: id})}
      onItemEdit={id => navigation.navigate('EditItem', {listId, itemId: id})}
      onItemDelete={id => {
        /* handle delete */
      }}
      onAddPress={() => navigation.navigate('AddItem', {listId})}
      onRefresh={async () => {
        await refetch();
      }}
      onBack={() => navigation.goBack()}
      showUserHeader={false}
      headerActions={[
        {
          icon: 'edit',
          onPress: () => setIsEditing(true),
        },
        {
          icon: 'share',
          onPress: () => navigation.navigate('ShareList', {listId}),
        },
        {
          icon: 'settings',
          onPress: () => navigation.navigate('ListSettings', {listId}),
        },
      ]}
      emptyState={{
        icon: 'add-shopping-cart',
        title: 'No items yet',
        description: 'Add items to your shopping list',
        action: {
          label: 'Add first item',
          onPress: () => navigation.navigate('AddItem', {listId}),
        },
      }}
    />
  );
};

const detailStyles = createStyleSheet(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  editForm: {
    padding: 16,
  },
  nameInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    backgroundColor: 'white',
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
}));
