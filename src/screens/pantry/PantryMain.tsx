import React, { useMemo, useEffect, useCallback, useRef } from 'react';
import { Alert, View, Image } from 'react-native';
import { useAppNavigation } from '#hooks';
import { useUnistyles, StyleSheet } from 'react-native-unistyles';
import { useDefaultHome, usePantryManagement } from '#hooks';
import { useStore } from '#store';
import { useGetHomeBasicQuery } from '#generated';
import { useScanner } from '#context';
import {
  ListTemplate,
  SearchBarAction,
  HeaderAction,
  AnimatedItemSelector,
  FormattedItemSubtitle,
} from '#components';
import type {
  SelectorConfig,
  ItemSelectorRef,
} from '#components/organisms/AnimatedItemSelector';

export const PantryMain: React.FC = () => {
  const { navigate, navigateTo } = useAppNavigation();
  const { theme } = useUnistyles();
  const { setScannerProps, setOverlayOpen } = useScanner();

  const setSelectedPantryId = useStore(state => state.setSelectedPantryId);
  const selectedPantryId = useStore(state => state.selectedPantryId);
  const selectorRef = useRef<ItemSelectorRef>(null);

  const { selectedHomeId, homes, getDefaultPantry } = useDefaultHome();

  // Try to get home data from homes list first to avoid extra query
  const homeFromList = homes.find((home: any) => home.id === selectedHomeId);

  const { data: homeData, refetch: refetchHome } = useGetHomeBasicQuery({
    variables: { homeId: selectedHomeId ?? '' },
    fetchPolicy: 'cache-and-network', // Always check network for fresh data after token refresh
    skip: !selectedHomeId,
    notifyOnNetworkStatusChange: true,
    errorPolicy: 'all', // Allow partial data and cache on errors
  });

  // Use home data from either source
  const currentHomeData = useMemo(() => {
    return homeFromList ? { home: homeFromList } : homeData;
  }, [homeFromList, homeData]);

  // Use selected pantry from store or fall back to default pantry
  const defaultPantry = useMemo(
    () => getDefaultPantry(currentHomeData),
    [currentHomeData, getDefaultPantry],
  );

  const pantry = useMemo(() => {
    if (selectedPantryId) {
      return (
        currentHomeData?.home?.pantries?.find(
          (p: any) => p.id === selectedPantryId,
        ) || defaultPantry
      );
    }
    return defaultPantry;
  }, [selectedPantryId, currentHomeData, defaultPantry]);

  // Auto-select the default pantry if none is selected
  useEffect(() => {
    if (!selectedPantryId && defaultPantry?.id) {
      setSelectedPantryId(defaultPantry.id);
    }
  }, [selectedPantryId, defaultPantry?.id, setSelectedPantryId]);

  const handleScanPress = useCallback(() => {
    if (!selectedHomeId) {
      Alert.alert(
        'No Home Selected',
        'You need to be a member of a home to scan items.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Manage Homes',
            onPress: () => navigate('HomeManagement'),
            style: 'default',
          },
        ],
      );
      return;
    }
    navigateTo.barcode({ source: 'pantry', pantryId: pantry?.id });
  }, [selectedHomeId, navigate, navigateTo, pantry?.id]);

  // Set up scanner button when component mounts
  useEffect(() => {
    setScannerProps(handleScanPress, true);

    // Clean up on unmount
    return () => {
      setScannerProps(undefined, false);
    };
  }, [setScannerProps, handleScanPress]);

  const {
    items: pantryItems,
    allItems,
    searchQuery,
    setSearchQuery,
    stats,
    removeItem,
    refetch,
    loading,
  } = usePantryManagement(pantry?.id);

  // Refetch pantry items when switching between pantries
  const prevPantryIdRef = useRef<string | undefined>(pantry?.id);
  useEffect(() => {
    const currentPantryId = pantry?.id;
    const prevPantryId = prevPantryIdRef.current;

    // Only refetch if pantry actually changed (skip initial mount)
    if (prevPantryId && currentPantryId && prevPantryId !== currentPantryId) {
      refetch();
    }

    // Update ref for next comparison
    prevPantryIdRef.current = currentPantryId;
  }, [pantry?.id, refetch]);

  // Create selector configuration for pantries
  const pantryConfig: SelectorConfig<any> = useMemo(() => {
    // Extract pantries from working data source inside useMemo
    const availablePantries = currentHomeData?.home?.pantries || [];

    return {
      title: 'Select Pantry',
      data: availablePantries,
      selectedId: pantry?.id,
      onSelect: (id: string) => {
        setSelectedPantryId(id);
        selectorRef.current?.close();
      },
      displayProperty: 'name',
      loading,
      emptyMessage: 'No pantries available',
      actions: [
        {
          icon: 'add',
          label: 'Create New Pantry',
          onPress: () => {
            selectorRef.current?.close();
            navigate('PantrySettings', { pantryId: undefined });
          },
          iconLibrary: 'MaterialIcons' as const,
        },
        {
          icon: 'settings',
          label: 'Edit Selected Pantry',
          onPress: () => {
            selectorRef.current?.close();
            if (pantry?.id) {
              navigate('PantrySettings', { pantryId: pantry.id });
            }
          },
          iconLibrary: 'MaterialIcons' as const,
          disabled: !pantry?.id,
        },
      ],
    };
  }, [
    currentHomeData?.home?.pantries,
    pantry?.id,
    loading,
    setSelectedPantryId,
    navigate,
  ]);

  // Transform pantry items to list items format
  const items = useMemo(() => {
    const transformedItems = pantryItems.map((item: any) => {
      const isExpired = item.expiresAt && new Date(item.expiresAt) < new Date();
      const isLowStock =
        item.autoReorderPoint && item.currentQuantity <= item.autoReorderPoint;

      return {
        id: item.id,
        title: item.item?.name || '',
        subtitle: (
          <FormattedItemSubtitle
            quantity={item.currentQuantity}
            netWeight={item.item?.netWeight}
            unitSymbol={item.item?.displayUnit?.symbol || item.unit?.symbol}
            additionalInfo={item.storageState}
          />
        ),
        badge: isExpired
          ? { text: 'Expired', variant: 'danger' }
          : isLowStock
          ? { text: 'Low Stock', variant: 'warning' }
          : undefined,
        leftElement: item.item?.imageUrl ? (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: item.item.imageUrl }}
              style={styles.leftImage}
            />
          </View>
        ) : undefined,
      };
    });

    return transformedItems;
  }, [pantryItems]);

  const handleAddItem = useCallback(() => {
    if (!selectedHomeId) {
      Alert.alert(
        'No Home Selected',
        'You need to be a member of a home to add pantry items.',
        [
          { text: 'Cancel', style: 'cancel' },
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
  }, [selectedHomeId, navigate, navigateTo]);

  const handleDeleteItem = async (itemId: string) => {
    return await removeItem(itemId);
  };

  const handleRefresh = async () => {
    await Promise.all([refetch(), refetchHome()]);
  };

  const handleOverlayOpen = useCallback(() => {
    setOverlayOpen(true);
  }, [setOverlayOpen]);

  const handleOverlayClose = useCallback(() => {
    setOverlayOpen(false);
  }, [setOverlayOpen]);

  // Header actions
  const headerActions = useMemo(() => {
    const rightActions: HeaderAction[] = [];

    // Only show right actions if there are items
    if (items.length > 0) {
      // Show expired items action only if there are expired items
      if (stats.expired > 0) {
        rightActions.push({
          icon: 'schedule',
          onPress: () => navigate('ExpiringItems'),
          badge: stats.expired,
          color: '#FF6B6B',
        });
      }

      // Show low stock action only if there are low stock items
      if (stats.lowStock > 0) {
        rightActions.push({
          icon: 'warning',
          onPress: () => navigate('LowStockItems'),
          badge: stats.lowStock,
          color: '#FFB84D',
        });
      }

      // Show category management only if items have categories
      const hasCategories = pantryItems.some(
        (item: any) => item.item?.category?.id,
      );
      if (hasCategories) {
        rightActions.push({
          icon: 'category',
          onPress: () => navigate('CategoryManagement'),
        });
      }
    }

    return {
      left: [
        {
          icon: 'home-switch-outline',
          onPress: () => navigate('HomeManagement', { homeId: selectedHomeId }),
          size: 34,
          color: theme.colors.primary,
          library: 'MaterialDesignIcons',
        },
      ] as HeaderAction[],
      right: rightActions,
    };
  }, [
    navigate,
    selectedHomeId,
    theme.colors.primary,
    stats.expired,
    stats.lowStock,
    items.length,
    pantryItems,
  ]);

  // Search bar actions
  const searchBarActions = useMemo(
    () => ({
      left: [] as SearchBarAction[],
      right: [
        {
          icon: 'add',
          onPress: handleAddItem,
          color: theme.colors.primary,
          backgroundColor: '#fff',
        },
        {
          icon: 'list',
          color: '#fff',
          onPress: () => selectorRef.current?.open(),
        },
      ] as SearchBarAction[],
    }),
    [handleAddItem, theme.colors.primary],
  );

  // Determine loading state - only show loading if we have no data at all
  const isLoadingInitial = loading && items.length === 0 && !allItems?.length;

  // Compute empty state based on current context
  const emptyStateConfig = !selectedHomeId
    ? {
        icon: 'home',
        title: 'No Home Selected',
        description:
          'You need to create or be a member of a home to manage pantry items.',
        action: {
          label: 'Manage Homes',
          onPress: () => navigate('HomeManagement'),
        },
      }
    : {
        icon: 'inventory',
        title: 'No items in pantry',
        description: 'Add items to track your pantry inventory',
        action: {
          label: 'Add first item',
          onPress: handleAddItem,
        },
      };

  return (
    <View style={styles.container}>
      <ListTemplate
        title={selectedHomeId ? currentHomeData?.home?.name || 'Pantry' : ''}
        subtitle={selectedHomeId ? pantry?.name || 'Your Pantry' : ''}
        items={items}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onItemPress={id => navigateTo.pantryItemDetail({ itemId: id })}
        onItemEdit={id => navigateTo.pantryItem({ itemId: id })}
        onItemDelete={handleDeleteItem}
        onRefresh={handleRefresh}
        loading={isLoadingInitial}
        hasNoData={!selectedHomeId}
        showHeader={true}
        showSearchBar={true}
        headerActions={headerActions}
        searchBarActions={searchBarActions}
        emptyState={emptyStateConfig}
      />
      <AnimatedItemSelector
        ref={selectorRef}
        config={pantryConfig}
        maxHeight={600}
        onOpen={handleOverlayOpen}
        onClose={handleOverlayClose}
      />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  imageContainer: {
    width: theme.sizes.listImage.width,
    height: theme.sizes.listImage.height,
    marginRight: theme.spacing.md,
    borderRadius: theme.radii.md,
    overflow: 'hidden',
  },
  leftImage: {
    width: theme.sizes.listImage.width,
    height: theme.sizes.listImage.height,
    borderRadius: theme.radii.md,
    resizeMode: 'cover',
    elevation: 2,
  },
}));
