import React, {useMemo} from 'react';
import {Alert} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {useStyles} from 'react-native-unistyles';
import {
  useDefaultHome,
  usePantryManagement,
  useBottomSheetModal,
  usePantrySelector,
} from '#hooks';
import {useGetHomeQuery} from '#generated';
import {PantryMainNavProp} from '#navigation/types';
import {
  ListTemplate,
  SearchBarAction,
  BottomSheetAction,
  HeaderAction,
  ItemSelector,
  EmptyState,
} from '#components';

export const PantryMain: React.FC = () => {
  const navigation = useNavigation<PantryMainNavProp>();

  const {theme} = useStyles();

  const selectPantrySheet = useBottomSheetModal();

  const {
    selectedHomeId,
    loading: homesLoading,
    getDefaultPantry,
  } = useDefaultHome();

  const {data: homeData} = useGetHomeQuery({
    variables: {homeId: selectedHomeId ?? ''},
    fetchPolicy: 'cache-and-network',
    skip: !selectedHomeId,
  });

  const pantry = getDefaultPantry(homeData);

  const selector = usePantrySelector({
    initialSelected: pantry?.id,
    onSelect: (id, item) => {
      // Do something with the selected pantry
      console.log('Selected pantry:', id, item);
    },
  });
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
  } = usePantryManagement(pantry?.id);

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

  // Header actions
  const headerActions = useMemo(
    () => ({
      left: [
        {
          icon: 'home-switch-outline',
          onPress: () =>
            navigation.getParent()?.navigate('HomeManagementStack', {
              screen: 'HomeManagement',
              params: {homeId: selectedHomeId},
            }),
          size: 34,
          color: theme.colors.primary,
          library: 'MaterialDesignIcons',
        },
      ] as HeaderAction[],
      right: [
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
      ] as HeaderAction[],
    }),
    [
      navigation,
      selectedHomeId,
      theme.colors.primary,
      stats.expired,
      stats.lowStock,
    ],
  );

  // Search bar actions
  const searchBarActions = useMemo(
    () => ({
      left: [] as SearchBarAction[],
      right: [
        {
          icon: 'list',
          color: '#fff',
          onPress: () => selectPantrySheet.open(),
        },
        {
          icon: 'add',
          onPress: handleAddItem,
          color: '#fff',
        },
      ] as SearchBarAction[],
    }),
    [navigation, theme.colors, handleAddItem],
  );

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
        subtitle="your pantry"
        items={[]}
        searchQuery=""
        onSearchChange={() => {}}
        onItemPress={() => {}}
        showHeader={true}
        showSearchBar={true}
        showFAB={false} // Don't show FAB since we have add in search bar
        headerActions={headerActions}
        searchBarActions={searchBarActions}
        onRefresh={async () => {
          await refetch();
        }}
        emptyState={{
          icon: 'inventory',
          title: 'Loading...',
          description: 'Loading your pantry items',
        }}
      />
    );
  }

  return (
    <>
      <ListTemplate
        title={homeData?.home?.name || 'Pantry'}
        subtitle={pantry?.name || 'Your Pantry'}
        items={items}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onItemPress={id =>
          navigation.navigate('PantryItemDetail', {itemId: id})
        }
        onItemEdit={id => navigation.navigate('EditPantryItem', {itemId: id})}
        onItemDelete={handleDeleteItem}
        onRefresh={async () => {
          await refetch();
        }}
        // Display configuration
        showHeader={true}
        showSearchBar={true}
        showFAB={true} // Don't show FAB since we have add in search bar
        onFabPress={() =>
          navigation.getParent()?.navigate('BarcodeStack', {
            screen: 'BarcodeScanner',
          })
        }
        // Actions
        headerActions={headerActions}
        searchBarActions={searchBarActions}
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
      <BottomSheetAction
        key={'select'}
        sheetRef={selectPantrySheet.ref}
        sheetTitle={'Select Pantry'}
        snapPoints={['25%', '50%', '90%']}>
        <ItemSelector
          data={selector.data}
          selectedId={selector.selectedId}
          onSelect={selector.handleSelect}
          displayProperty="name"
          loading={selector.loading}
          emptyMessage={selector.emptyMessage}
        />
      </BottomSheetAction>
    </>
  );
};
