import React, { useMemo, useEffect, useCallback, useRef, useState } from 'react';
import { Alert, View, Image } from 'react-native';
import { PaginationFooter } from '#/components/organisms/PaginationFooter';
import { useAppNavigation } from '#hooks';
import { useUnistyles, StyleSheet } from 'react-native-unistyles';
import { useDefaultHome, usePantryManagement } from '#hooks';
import { useStore } from '#store';
import {
  useGetHomeBasicQuery,
  useCreatePantryItemUsageMutation,
  useRecordPantryItemWasteMutation,
  UsagePurpose,
  WasteReason,
} from '#generated';
import { useScanner } from '#context';
import { commonStyles } from '#/styles';
import { useFeatureHint } from '#/hooks/useFeatureHint';
import { FeatureHintOverlay } from '#/components/organisms/FeatureHintOverlay';

import {
  ListTemplate,
  SearchBarAction,
  HeaderAction,
  AnimatedItemSelector,
  FormattedItemSubtitle,
} from '#components';
import { ConsumePantryItemModal } from '#components/modals/ConsumePantryItemModal';
import { RecordWastePantryItemModal } from '#components/modals/RecordWastePantryItemModal';
import { getItemImageUrl } from '#utils/imageUtils';
import type {
  SelectorConfig,
  ItemSelectorRef,
} from '#components/organisms/AnimatedItemSelector';
import { normalizeHome } from '#/utils/connectionUtils';

export const PantryMain: React.FC = () => {
  const { navigate, navigateTo } = useAppNavigation();
  const { theme } = useUnistyles();
  const { setScannerProps, setOverlayOpen } = useScanner();

  // Feature hint for home switch button
  const homeSwitchHint = useFeatureHint({
    featureId: 'pantry_home_switch',
    showOnMount: false, // We'll manually trigger when appropriate
  });

  const setSelectedPantryId = useStore(state => state.setSelectedPantryId);
  const selectedPantryId = useStore(state => state.selectedPantryId);
  const selectorRef = useRef<ItemSelectorRef>(null);
  const openSwipeableRef = useRef<any>(null);

  // Consume item state
  const [consumeModalVisible, setConsumeModalVisible] = useState(false);
  const [selectedItemForConsume, setSelectedItemForConsume] = useState<any>(null);

  // Waste item state
  const [wasteModalVisible, setWasteModalVisible] = useState(false);
  const [selectedItemForWaste, setSelectedItemForWaste] = useState<any>(null);

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
  const normalizedHomeResult = useMemo(() => {
    if (!homeData?.home) {
      return undefined;
    }
    const normalized = normalizeHome(homeData.home);
    return normalized ? { home: normalized } : undefined;
  }, [homeData]);

  const currentHomeData = useMemo(() => {
    if (homeFromList) {
      return { home: homeFromList };
    }
    return normalizedHomeResult;
  }, [homeFromList, normalizedHomeResult]);

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
    loadMore,
    hasMore,
    isLoadingMore,
  } = usePantryManagement(pantry?.id);

  // Consume item mutation
  const [createPantryItemUsage] = useCreatePantryItemUsageMutation({
    errorPolicy: 'all',
    onError: error => {
      console.error('Failed to create pantry item usage:', error);
      Alert.alert('Error', 'Failed to record item consumption. Please try again.');
    },
  });

  // Waste item mutation
  const [recordPantryItemWaste] = useRecordPantryItemWasteMutation({
    errorPolicy: 'all',
    onError: error => {
      console.error('Failed to record pantry item waste:', error);
      Alert.alert('Error', 'Failed to record waste. Please try again.');
    },
  });

  // Handler to open consume modal
  const handleConsumeItem = useCallback((itemId: string) => {
    const item = pantryItems.find(p => p.id === itemId);
    if (item) {
      setSelectedItemForConsume(item);
      setConsumeModalVisible(true);
    }
  }, [pantryItems]);

  // Handler to confirm consumption
  const handleConfirmConsume = useCallback(async (
    quantityUsed: number,
    quantityInput: string,
    purpose: UsagePurpose,
    notes: string,
  ) => {
    if (!selectedItemForConsume) return;

    try {
      await createPantryItemUsage({
        variables: {
          input: {
            pantryItemId: selectedItemForConsume.id,
            quantityUsed,
            purpose,
            notes: notes || undefined,
          },
        },
      });

      // Reset state
      setConsumeModalVisible(false);
      setSelectedItemForConsume(null);

      // Refetch to get updated quantities
      await refetch();
    } catch (error) {
      console.error('Error consuming pantry item:', error);
    }
  }, [selectedItemForConsume, createPantryItemUsage, refetch]);

  // Handler to close consume modal
  const handleCloseConsumeModal = useCallback(() => {
    setConsumeModalVisible(false);
    setSelectedItemForConsume(null);
  }, []);

  // Handler to open waste modal
  const handleWasteItem = useCallback((itemId: string) => {
    const item = pantryItems.find(p => p.id === itemId);
    if (item) {
      setSelectedItemForWaste(item);
      setWasteModalVisible(true);
    }
  }, [pantryItems]);

  // Handler to confirm waste recording
  const handleConfirmWaste = useCallback(async (
    wasteAmount: number,
    wasteReason: WasteReason,
    isComposted: boolean,
    isRecycled: boolean,
    _notes: string,
  ) => {
    if (!selectedItemForWaste) return;

    try {
      await recordPantryItemWaste({
        variables: {
          id: selectedItemForWaste.id,
          wasteAmount,
          wasteReason,
          isComposted,
          isRecycled,
        },
      });

      // Reset state
      setWasteModalVisible(false);
      setSelectedItemForWaste(null);

      // Refetch to get updated quantities
      await refetch();
    } catch (error) {
      console.error('Error recording pantry item waste:', error);
    }
  }, [selectedItemForWaste, recordPantryItemWaste, refetch]);

  // Handler to close waste modal
  const handleCloseWasteModal = useCallback(() => {
    setWasteModalVisible(false);
    setSelectedItemForWaste(null);
  }, []);

  // Handle swipeable item opening - ensure only one item is open at a time
  const handleSwipeableWillOpen = useCallback((ref: any) => {
    if (openSwipeableRef.current && openSwipeableRef.current !== ref) {
      // Close the previously open swipeable
      openSwipeableRef.current.current?.close();
    }
    // Update to track the newly opening swipeable
    openSwipeableRef.current = ref;
  }, []);

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
        leftElement: (() => {
          const imageUrl = getItemImageUrl(item.item);
          return imageUrl ? (
            <View
              style={[
                commonStyles.listItemImageContainer,
                { backgroundColor: theme.colors.surface },
              ]}
            >
              <Image
                source={{ uri: imageUrl }}
                style={[commonStyles.listItemImage, { resizeMode: 'contain' }]}
              />
            </View>
          ) : undefined;
        })(),
      };
    });

    return transformedItems;
  }, [pantryItems, theme]);

  // Show home switch hint when user has items and home is selected
  useEffect(() => {
    if (selectedHomeId && items.length > 0 && !homeSwitchHint.hasBeenShown) {
      // Show hint after a delay to let UI settle
      const timer = setTimeout(() => {
        homeSwitchHint.show();
      }, 2000); // 2 seconds delay
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, selectedHomeId, homeSwitchHint.hasBeenShown, homeSwitchHint.show]);

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
          color: theme.colors.error,
        });
      }

      // Show low stock action only if there are low stock items
      if (stats.lowStock > 0) {
        rightActions.push({
          icon: 'warning',
          onPress: () => navigate('LowStockItems'),
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
          onPress: () => {
            setOverlayOpen(true);
            selectorRef.current?.open();
          },
        },
      ] as SearchBarAction[],
    }),
    [
      handleAddItem,
      theme.colors.primary,
      theme.colors.surface,
      theme.colors.white,
      setOverlayOpen,
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
        onItemConsume={handleConsumeItem}
        onItemWaste={handleWasteItem}
        onRefresh={handleRefresh}
        onSwipeableWillOpen={handleSwipeableWillOpen}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          <PaginationFooter
            isLoadingMore={isLoadingMore}
            hasMore={hasMore}
            loading={loading}
            itemCount={items.length}
          />
        }
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
      <ConsumePantryItemModal
        visible={consumeModalVisible}
        pantryItem={selectedItemForConsume}
        onClose={handleCloseConsumeModal}
        onConfirm={handleConfirmConsume}
      />
      <RecordWastePantryItemModal
        visible={wasteModalVisible}
        pantryItem={selectedItemForWaste}
        onClose={handleCloseWasteModal}
        onConfirm={handleConfirmWaste}
      />

      {/* Home switch hint overlay */}
      {homeSwitchHint.isVisible && (
        <FeatureHintOverlay
          config={{
            title: 'Tap to manage homes',
            subtitle: 'Click the home icon to switch between homes or manage home settings',
            icon: {
              name: 'home-switch-outline',
              library: 'MaterialDesignIcons',
              size: 40,
            },
            onDismiss: homeSwitchHint.dismiss,
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
}));
