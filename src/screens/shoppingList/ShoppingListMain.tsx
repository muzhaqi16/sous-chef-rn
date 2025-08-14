import React, {useMemo} from 'react';
import {useNavigation} from '@react-navigation/native';
import {useGetShoppingListsQuery} from '#generated';
import {ShoppingListMainNavProp} from '#navigation/types';
import {ListTemplate} from '#components/templates/ListTemplate';

export const ShoppingListMain: React.FC = () => {
  const navigation = useNavigation<ShoppingListMainNavProp>();
  const [searchQuery, setSearchQuery] = React.useState('');

  const {data, refetch} = useGetShoppingListsQuery({
    fetchPolicy: 'cache-and-network',
  });

  const lists = data?.shoppingLists || [];

  const items = useMemo(() => {
    const allLists = lists.map((list: any) => ({
      id: list.id,
      title: list.name,
      subtitle: `${list.items?.length || 0} items • ${list.collaborators?.length || 0} members`,
      badge: list.isDefault
        ? {text: 'Default', variant: 'primary' as const}
        : undefined,
    }));

    if (!searchQuery) return allLists;

    return allLists.filter(item =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [lists, searchQuery]);

  return (
    <ListTemplate
      items={items}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      onItemPress={id =>
        navigation.navigate('ShoppingListDetail', {listId: id})
      }
      onAddPress={() =>
        navigation.navigate('ShoppingListDetail', {listId: 'new'})
      }
      onRefresh={async () => {
        await refetch();
      }}
      emptyState={{
        icon: 'shopping-cart',
        title: 'No shopping lists yet',
        description: 'Create your first list to get started',
        action: {
          label: 'Create your first list',
          onPress: () =>
            navigation.navigate('ShoppingListDetail', {listId: 'new'}),
        },
      }}
    />
  );
};
