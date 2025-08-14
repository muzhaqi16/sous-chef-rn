import React, {useMemo} from 'react';
import {Alert} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {useDefaultHome, usePantryManagement} from '#hooks';
import {useGetHomeQuery} from '#generated';
import {PantryMainNavProp} from '#navigation/types';
import {ListTemplate} from '#components/templates/ListTemplate';
import {EmptyState} from '#components/molecules/EmptyState';

export const PantryMain: React.FC = () => {
  const navigation = useNavigation<PantryMainNavProp>();

  const {
    selectedHomeId,
    loading: homesLoading,
    getDefaultPantryId,
  } = useDefaultHome();

  console.log('Selected Home ID:', selectedHomeId);

  const {data: homeData} = useGetHomeQuery({
    variables: {homeId: selectedHomeId ?? ''},
    fetchPolicy: 'cache-and-network',
    skip: !selectedHomeId,
  });

  const pantryId = getDefaultPantryId(homeData);

  const {
    items: pantryItems,
    searchQuery,
    setSearchQuery,
    stats,
    removeItem,
    refetch,
    loading,
    getExpiredItems,
    getLowStockItems,
  } = usePantryManagement(pantryId);

  // Transform pantry items to list items format
  const items = useMemo(() => {
    return pantryItems.map(item => {
      const isExpired = item.expiresAt && new Date(item.expiresAt) < new Date();
      const isLowStock = item.currentQuantity <= (item.reservedQuantity || 0);

      return {
        id: item.id,
        title: item.item?.name || '',
        subtitle:
          `${item.currentQuantity} ${item.unit?.symbol || ''} • ${item.storageState}`.trim(),
        badge: isExpired
          ? {text: 'Expired', variant: 'danger' as const}
          : isLowStock
            ? {text: 'Low Stock', variant: 'warning' as const}
            : undefined,
      };
    });
  }, [pantryItems]);

  const handleAddItem = () => {
    if (!selectedHomeId) {
      Alert.alert(
        'No Home Selected',
        'You need to be a member of a home to add pantry items.',
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Manage Homes',
            onPress: () => navigation.navigate('HomeManagement'),
          },
        ],
      );
      return;
    }
    navigation.navigate('AddPantryItem');
  };

  const handleDeleteItem = async (itemId: string) => {
    return await removeItem(itemId);
  };

  if (!selectedHomeId) {
    return (
      <EmptyState
        icon="home"
        title="No Home Selected"
        description="You need to be a member of a home to manage pantry items."
        action={{
          label: 'Manage Homes',
          onPress: () => navigation.navigate('HomeManagement'),
        }}
      />
    );
  }

  if (loading || homesLoading) {
    return (
      <ListTemplate
        title="Pantry"
        items={[]}
        searchQuery=""
        onSearchChange={() => {}}
        onItemPress={() => {}}
        onAddPress={handleAddItem}
        onRefresh={async () => {
          await refetch();
        }}
        headerActions={[]}
        emptyState={{
          icon: 'inventory',
          title: 'Loading...',
          description: 'Loading your pantry items',
        }}
      />
    );
  }

  return (
    <ListTemplate
      title="Pantry"
      items={items}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      onItemPress={id => navigation.navigate('PantryItemDetail', {itemId: id})}
      onItemEdit={id => navigation.navigate('EditPantryItem', {itemId: id})}
      onItemDelete={handleDeleteItem}
      onAddPress={handleAddItem}
      onRefresh={async () => {
        await refetch();
      }}
      headerActions={[
        {
          icon: 'schedule',
          onPress: () => navigation.navigate('ExpiringItems'),
          badge: stats.expired,
          color: '#FF6B6B',
        },
        {
          icon: 'warning',
          onPress: () => navigation.navigate('LowStockItems'),
          badge: stats.lowStock,
          color: '#FFB84D',
        },
        {
          icon: 'category',
          onPress: () => navigation.navigate('CategoryManagement'),
        },
      ]}
      emptyState={{
        icon: 'inventory',
        title: 'No items in pantry',
        description: 'Add items to track your pantry inventory',
        action: {
          label: 'Add first item',
          onPress: handleAddItem,
        },
      }}
    />
  );
};
