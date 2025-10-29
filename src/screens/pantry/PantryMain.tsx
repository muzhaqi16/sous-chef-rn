import React, { useMemo, useEffect, useCallback, useRef } from 'react';
import { Alert, View } from 'react-native';
import { useAppNavigation } from '#hooks';
import { useUnistyles, StyleSheet } from 'react-native-unistyles';
import {
  useDefaultHome,
  usePantryManagement,
  usePantryItemTransformation,
  usePantrySelectorConfig,
} from '#hooks';
import { useHaptic } from '#hooks/haptic';
import { useScreenTransition } from '#hooks/performance';
import { useScannerSetup } from '#hooks/scanner';
import { useSelectorManagement } from '#hooks/ui';
import { useStore } from '#store';
import { useGetHomeBasicQuery } from '#generated';
import { useScanner } from '#context';

import {
  ListTemplate,
  SearchBarAction,
  HeaderAction,
  AnimatedItemSelector,
} from '#components';
import { PantryContent } from '#components/pantry';
import type { ItemSelectorRef } from '#components/organisms/AnimatedItemSelector';

export const PantryMain: React.FC = () => {
  const { navigate, navigateTo } = useAppNavigation();
  const { theme } = useUnistyles();
  const { setOverlayOpen } = useScanner();
  const haptic = useHaptic();

  // Track screen performance
  useScreenTransition('PantryMain');

  const setSelectedPantryId = useStore(state => state.setSelectedPantryId);
  const selectedPantryId = useStore(state => state.selectedPantryId);
  const selectorRef = useRef<ItemSelectorRef>(null);

  // Manage selector with overlay coordination
  const { handleOpenSelector, handleOverlayOpen, handleOverlayClose } =
    useSelectorManagement({
      selectorRef,
      setOverlayOpen,
    });

  const { selectedHomeId, homes, getDefaultPantry } = useDefaultHome();

  // Try to get home data from homes list first to avoid extra query
  const homeFromList = homes.find((home: any) => home.id === selectedHomeId);

  const { data: homeData, refetch: refetchHome } = useGetHomeBasicQuery({
    variables: { homeId: selectedHomeId ?? '' },
    fetchPolicy: 'cache-and-network', // Always check network for fresh data after token refresh
    nextFetchPolicy: 'cache-first', // Subsequent fetches use cache to avoid unnecessary refetches
    skip: !selectedHomeId,
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
    let result;

    // Try to find selected pantry in current home data
    if (selectedPantryId && currentHomeData?.home?.pantries) {
      result = currentHomeData.home.pantries.find(
        (p: any) => p.id === selectedPantryId,
      );
      if (result) {
        return result;
      }
    }

    // Fall back to default pantry
    if (defaultPantry) {
      return defaultPantry;
    }

    // Last resort: if we have selectedPantryId but no home data yet
    // (e.g., during loading or network error), create minimal pantry object
    // to keep the query running with the correct ID
    if (selectedPantryId) {
      return {
        id: selectedPantryId,
        name: 'Pantry',
        isDefault: false,
      };
    }

    return null;
  }, [selectedPantryId, currentHomeData, defaultPantry]);

  // Auto-select the default pantry if none is selected
  useEffect(() => {
    if (!selectedPantryId && defaultPantry?.id) {
      setSelectedPantryId(defaultPantry.id);
    }
  }, [selectedPantryId, defaultPantry?.id, setSelectedPantryId]);

  // Set up scanner button
  useScannerSetup({
    enabled: true,
    homeId: selectedHomeId,
    context: {
      source: 'pantry',
      pantryId: pantry?.id,
    },
  });

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
  const pantryConfig = usePantrySelectorConfig({
    pantries: currentHomeData?.home?.pantries || [],
    selectedPantryId: pantry?.id,
    loading,
    setSelectedPantryId,
    selectorRef,
    navigate,
  });

  // Transform pantry items to list items format
  const items = usePantryItemTransformation({
    items: pantryItems,
    theme,
  });

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
    try {
      haptic.warning(); // Haptic feedback on delete
      return await removeItem(itemId);
    } catch (error) {
      haptic.error(); // Error haptic on failure
      throw error;
    }
  };

  const handleRefresh = async () => {
    await Promise.all([refetch(), refetchHome()]);
  };

  // Header actions
  const headerActions = useMemo(() => {
    const rightActions: HeaderAction[] = [];

    // Only show right actions if there are items
    if (items.length > 0) {
      // Show expired items action only if there are expired items
      if (stats.expired > 0) {
        rightActions.push({
          icon: 'schedule',
          onPress: () => {
            haptic.error(); // Error haptic for expired items alert
            navigate('ExpiringItems');
          },
          badge: stats.expired,
          color: theme.colors.error,
        });
      }

      // Show low stock action only if there are low stock items
      if (stats.lowStock > 0) {
        rightActions.push({
          icon: 'warning',
          onPress: () => {
            haptic.warning(); // Warning haptic for low stock alert
            navigate('LowStockItems');
          },
          badge: stats.lowStock,
          color: theme.colors.warning,
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
    stats.expired,
    stats.lowStock,
    items.length,
    pantryItems,
    theme,
    haptic,
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
          backgroundColor: theme.colors.surface,
        },
        {
          icon: 'list',
          color: theme.colors.white,
          onPress: handleOpenSelector,
        },
      ] as SearchBarAction[],
    }),
    [
      handleAddItem,
      handleOpenSelector,
      theme.colors.primary,
      theme.colors.surface,
      theme.colors.white,
    ],
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
        customListComponent={PantryContent}
        customListProps={{
          loading: isLoadingInitial,
        }}
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
}));
