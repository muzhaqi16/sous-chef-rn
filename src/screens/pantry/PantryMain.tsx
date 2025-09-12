import React, {useMemo, useEffect} from 'react';
import {Alert, View, Image} from 'react-native';
import {useNavigationFlow} from '#hooks';
import {useUnistyles, StyleSheet} from 'react-native-unistyles';
import {
  useDefaultHome,
  usePantryManagement,
  useBottomSheetModal,
  usePantrySelector,
} from '#hooks';
import {useStore} from '#store';
import {useGetHomeQuery} from '#generated';
import {PantryMainNavProp} from '#navigation/types';
import {
  ListTemplate,
  SearchBarAction,
  BottomSheetAction,
  HeaderAction,
} from '#components';
import {ItemSelectorWithActions} from '#components/organisms/ItemSelectorWithActions';

export const PantryMain: React.FC = () => {
  const {
    navigateToHomeManagement,
    navigateWithinStack,
    navigateToBarcode,
  } = useNavigationFlow();

  const {theme} = useUnistyles();

  const selectPantrySheet = useBottomSheetModal();
  const setSelectedPantryId = useStore(state => state.setSelectedPantryId);
  const selectedPantryId = useStore(state => state.selectedPantryId);

  const {
    selectedHomeId,
    loading: homesLoading,
    getDefaultPantry,
  } = useDefaultHome();

  const {data: homeData} = useGetHomeQuery({
    variables: {homeId: selectedHomeId ?? ''},
    fetchPolicy: 'cache-first', // Use cache-first for immediate display
    skip: !selectedHomeId,
  });

  // Use selected pantry from store or fall back to default pantry
  const defaultPantry = getDefaultPantry(homeData);
  const pantry = selectedPantryId
    ? homeData?.home?.pantries?.find((p: any) => p.id === selectedPantryId) ||
      defaultPantry
    : defaultPantry;

  // Auto-select the default pantry if none is selected
  useEffect(() => {
    if (!selectedPantryId && defaultPantry?.id) {
      setSelectedPantryId(defaultPantry.id);
    }
  }, [selectedPantryId, defaultPantry?.id, setSelectedPantryId]);

  const selector = usePantrySelector({
    initialSelected: pantry?.id,
    onSelect: (id, item) => {
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
            onPress: () => navigateToHomeManagement(),
            style: 'default',
          },
        ],
      );
      return;
    }
    navigateWithinStack('PantryItem', {});
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
          onPress: () => navigateToHomeManagement(selectedHomeId || undefined),
          size: 34,
          color: theme.colors.primary,
          library: 'MaterialDesignIcons',
        },
      ] as HeaderAction[],
      right: [
        {
          icon: 'schedule',
          onPress: () => navigateWithinStack('ExpiringItems'),
          badge: stats.expired,
          color: '#FF6B6B',
        },
        {
          icon: 'warning',
          onPress: () => navigateWithinStack('LowStockItems'),
          badge: stats.lowStock,
          color: '#FFB84D',
        },
        {
          icon: 'category',
          onPress: () => navigateWithinStack('CategoryManagement'),
        },
      ] as HeaderAction[],
    }),
    [
      navigateToHomeManagement,
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
    [theme.colors, handleAddItem],
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
            onPress: () => navigateToHomeManagement(),
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
        title={homeData?.home?.name || 'Pantry'}
        subtitle={debugSubtitle}
        items={items}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onItemPress={id =>
          navigateWithinStack('PantryItemDetail', {itemId: id})
        }
        onItemEdit={id => navigateWithinStack('PantryItem', {itemId: id})}
        onItemDelete={handleDeleteItem}
        onRefresh={async () => {
          await refetch();
        }}
        // Display configuration
        showHeader={true}
        showSearchBar={true}
        showFAB={true} // Don't show FAB since we have add in search bar
        onFabPress={() =>
          navigateToBarcode('pantry', pantry?.id)
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
                navigateWithinStack('PantrySettings', {pantryId: undefined});
              },
              iconLibrary: 'MaterialIcons',
            },
            {
              icon: 'settings',
              label: 'Edit Current Pantry',
              onPress: () => {
                selectPantrySheet.close();
                if (pantry?.id) {
                  navigateWithinStack('PantrySettings', {pantryId: pantry.id});
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

const styles = StyleSheet.create(theme => ({
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
