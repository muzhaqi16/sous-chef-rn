import React, {useMemo, useEffect} from 'react';
import {Alert, View, Image} from 'react-native';
import {useAppNavigation} from '#hooks';
import {useUnistyles, StyleSheet} from 'react-native-unistyles';
import {
  useDefaultHome,
  usePantryManagement,
  useBottomSheetModal,
  usePantrySelector,
} from '#hooks';
import {useStore} from '#store';
import {useGetHomeBasicQuery} from '#generated';
import {
  ListTemplate,
  SearchBarAction,
  BottomSheetAction,
  HeaderAction,
} from '#components';
import {ItemSelectorWithActions} from '#components/organisms/ItemSelectorWithActions';

export const PantryMain: React.FC = () => {
  const {navigate, navigateTo} = useAppNavigation();
  const {theme} = useUnistyles();

  const selectPantrySheet = useBottomSheetModal();
  const setSelectedPantryId = useStore(state => state.setSelectedPantryId);
  const selectedPantryId = useStore(state => state.selectedPantryId);

  const {
    selectedHomeId,
    homes,
    loading: homesLoading,
    getDefaultPantry,
  } = useDefaultHome();

  // Try to get home data from homes list first to avoid extra query
  const homeFromList = homes.find(home => home.id === selectedHomeId);

  // Only skip the query if we have home data with pantries array
  const hasCompletePantryData = homeFromList?.pantries && Array.isArray(homeFromList.pantries);

  const {data: homeData} = useGetHomeBasicQuery({
    variables: {homeId: selectedHomeId ?? ''},
    fetchPolicy: 'cache-first',
    skip: !selectedHomeId || !!hasCompletePantryData, // Only skip if we have complete pantry data
  });


  // Use home data from either source
  const currentHomeData = homeFromList ? { home: homeFromList } : homeData;

  // Use selected pantry from store or fall back to default pantry
  const defaultPantry = useMemo(() => getDefaultPantry(currentHomeData), [currentHomeData, getDefaultPantry]);

  const pantry = useMemo(() => {
    if (selectedPantryId) {
      return currentHomeData?.home?.pantries?.find((p: any) => p.id === selectedPantryId) || defaultPantry;
    }
    return defaultPantry;
  }, [selectedPantryId, currentHomeData, defaultPantry]);

  // Auto-select the default pantry if none is selected
  useEffect(() => {
    if (!selectedPantryId && defaultPantry?.id) {
      setSelectedPantryId(defaultPantry.id);
    }
  }, [selectedPantryId, defaultPantry?.id, setSelectedPantryId]);

  const selector = usePantrySelector({
    initialSelected: pantry?.id,
    onSelect: (id, _item) => {
      // Update the global store with the selected pantry
      setSelectedPantryId(id);
      selectPantrySheet.close();
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
    hasLoadedCache,
    cacheInfo,
  } = usePantryManagement(pantry?.id);

  // Transform pantry items to list items format
  const items = useMemo(() => {
    const transformedItems = pantryItems.map(item => {
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
        leftElement: item.item?.imageUrl ? (
          <View style={styles.imageContainer}>
            <Image
              source={{uri: item.item.imageUrl}}
              style={styles.leftImage}
            />
          </View>
        ) : undefined,
      };
    });


    return transformedItems;
  }, [pantryItems, pantry?.id, hasLoadedCache, loading, cacheInfo]);

  const handleAddItem = () => {
    if (!selectedHomeId) {
      Alert.alert(
        'No Home Selected',
        'You need to be a member of a home to add pantry items.',
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Manage Homes',
            onPress: () => navigate('HomeManagement'),
            style: 'default',
          },
        ],
      );
      return;
    }
    navigateTo.pantryItem({});
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
          onPress: () => navigate('HomeManagement', {homeId: selectedHomeId}),
          size: 34,
          color: theme.colors.primary,
          library: 'MaterialDesignIcons',
        },
      ] as HeaderAction[],
      right: [
        {
          icon: 'schedule',
          onPress: () => navigate('ExpiringItems'),
          badge: stats.expired,
          color: '#FF6B6B',
        },
        {
          icon: 'warning',
          onPress: () => navigate('LowStockItems'),
          badge: stats.lowStock,
          color: '#FFB84D',
        },
        {
          icon: 'category',
          onPress: () => navigate('CategoryManagement'),
        },
      ] as HeaderAction[],
    }),
    [
      navigate,
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
          icon: 'add',
          onPress: handleAddItem,
          color: '#fff',
        },
        {
          icon: 'list',
          color: '#fff',
          onPress: () => selectPantrySheet.open(),
        },
      ] as SearchBarAction[],
    }),
    [handleAddItem],
  );

  if (!selectedHomeId) {
    return (
      <ListTemplate
        showHeader={true}
        emptyState={{
          icon: 'home',
          title: 'No Home Selected',
          description:
            'You need to create or be a member of a home to manage pantry items.',
          action: {
            label: 'Manage Homes',
            onPress: () => navigate('HomeManagement'),
          },
        }}
      />
    );
  }

  // Only show loading state if we have no cached data and are still loading
  if ((loading || homesLoading) && !hasLoadedCache && items.length === 0) {
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
        showFAB={false}
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

  // Debug info for development
  const debugSubtitle =
    __DEV__ && cacheInfo
      ? `${pantry?.name || 'Your Pantry'} • ${cacheInfo.itemCount} cached (${Math.round(cacheInfo.age / 1000)}s ago)`
      : pantry?.name || 'Your Pantry';

  return (
    <>
      <ListTemplate
        title={currentHomeData?.home?.name || 'Pantry'}
        subtitle={debugSubtitle}
        items={items}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onItemPress={id => navigateTo.pantryItemDetail({itemId: id})}
        onItemEdit={id => navigateTo.pantryItem({itemId: id})}
        onItemDelete={handleDeleteItem}
        onRefresh={async () => {
          await refetch();
        }}
        // Display configuration
        showHeader={true}
        showSearchBar={true}
        showFAB={true} // Don't show FAB since we have add in search bar
        onFabPress={() =>
          navigateTo.barcode({source: 'pantry', pantryId: pantry?.id})
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
        snapPoints={['60%', '90%']}>
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
              label: 'Create New Pantry',
              onPress: () => {
                selectPantrySheet.close();
                navigate('PantrySettings', {pantryId: undefined});
              },
              iconLibrary: 'MaterialIcons',
            },
            {
              icon: 'settings',
              label: 'Edit Current Pantry',
              onPress: () => {
                selectPantrySheet.close();
                if (pantry?.id) {
                  navigate('PantrySettings', {pantryId: pantry.id});
                }
              },
              iconLibrary: 'MaterialIcons',
            },
          ]}
        />
      </BottomSheetAction>
    </>
  );
};

const styles = StyleSheet.create(_theme => ({
  imageContainer: {
    width: 60,
    height: 60,
    marginRight: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  leftImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    resizeMode: 'cover',
    elevation: 2,
  },
}));
