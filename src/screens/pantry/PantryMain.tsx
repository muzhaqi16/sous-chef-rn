import React, {
  useMemo,
  useEffect,
  useCallback,
  useRef,
  useState,
} from 'react';
import { Alert, View } from 'react-native';
import { useAppNavigation } from '#hooks';
import { useUnistyles, StyleSheet } from 'react-native-unistyles';
import {
  useDefaultHome,
  usePantryManagement,
  usePantrySelectorConfig,
} from '#hooks';
import { useScreenTransition } from '#hooks/performance';
import { useScannerSetup } from '#hooks/scanner';
import { useSelectorManagement } from '#hooks/ui';
import { useAppStore, selectPantryState } from '#store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import {
  useGetHomeBasicQuery,
  useCreatePantryItemUsageMutation,
  useRecordPantryItemWasteMutation,
  useRestockPantryItemMutation,
  UsagePurpose,
  WasteReason,
  StorageState,
} from '#generated';
import { useScanner } from '#context';
import { useFeatureHint } from '#/hooks/useFeatureHint';
import { FeatureHintOverlay } from '#/components/organisms/FeatureHintOverlay';
import { Telemetry } from '#/services/telemetry';
import { useProfileData } from '#hooks/profile/useProfileData';

import { AnimatedItemSelector } from '#components';
import {
  PantryRedesignedContent,
  LocationFilter,
} from '#components/pantry';
import { ConsumePantryItemModal } from '#components/modals/ConsumePantryItemModal';
import { RecordWastePantryItemModal } from '#components/modals/RecordWastePantryItemModal';
import { RestockPantryItemModal } from '#components/modals/RestockPantryItemModal';
import type { ItemSelectorRef } from '#components/organisms/AnimatedItemSelector';
import { normalizeHome } from '#/utils/connectionUtils';
import { PantryErrorBoundary } from '#/components/providers/ScreenErrorBoundary';

// PERFORMANCE: Memoize screen component to prevent unnecessary re-renders
const PantryMainScreen: React.FC = React.memo(() => {
  const { navigate, navigateTo, isFocused } = useAppNavigation();
  useUnistyles();
  const { setOverlayOpen } = useScanner();

  // Get user profile for greeting
  const { profile } = useProfileData();

  // Track screen performance
  useScreenTransition('PantryMain');

  // Feature hint for home switch button
  const homeSwitchHint = useFeatureHint({
    featureId: 'pantry_home_switch',
    showOnMount: false, // We'll manually trigger when appropriate
  });

  // PERFORMANCE: Use grouped selector with useShallow to prevent infinite loops (Zustand v5)
  const { selectedPantryId, setSelectedPantryId } = useAppStore(
    useShallow(selectPantryState),
  );
  const showBiometricSetup = useAppStore(state => state.showBiometricSetup);
  const selectorRef = useRef<ItemSelectorRef>(null);


  // Consume item state
  const [consumeModalVisible, setConsumeModalVisible] = useState(false);
  const [selectedItemForConsume, setSelectedItemForConsume] =
    useState<any>(null);

  // Waste item state
  const [wasteModalVisible, setWasteModalVisible] = useState(false);
  const [selectedItemForWaste, setSelectedItemForWaste] = useState<any>(null);

  // Restock item state
  const [restockModalVisible, setRestockModalVisible] = useState(false);
  const [selectedItemForRestock, setSelectedItemForRestock] =
    useState<any>(null);

  // Location filter for redesigned tabs
  const [locationFilter, setLocationFilter] = useState<LocationFilter>('all');

  // Manage selector with overlay coordination
  const { handleOpenSelector, handleOverlayOpen, handleOverlayClose } =
    useSelectorManagement({
      selectorRef,
      setOverlayOpen,
    });

  const { selectedHomeId, homes, getDefaultPantry } = useDefaultHome();

  // Try to get home data from homes list first to avoid extra query
  const homeFromList = homes.find((home: any) => home.id === selectedHomeId);

  // PERFORMANCE: Skip query when tab is not focused to prevent wasted network requests
  const { data: homeData, refetch: refetchHome } = useGetHomeBasicQuery({
    variables: { homeId: selectedHomeId ?? '' },
    fetchPolicy: isFocused ? 'cache-and-network' : 'cache-only', // Only fetch when focused
    nextFetchPolicy: 'cache-first', // Subsequent fetches use cache to avoid unnecessary refetches
    skip: !selectedHomeId || !isFocused,
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

  // Set up scanner button
  useScannerSetup({
    enabled: true,
    homeId: selectedHomeId,
    context: {
      source: 'pantry',
      pantryId: pantry?.id,
    },
  });

  // PERFORMANCE: Pass undefined when not focused to skip pantry items query
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
    locationCounts,
    sectionedItems,
  } = usePantryManagement(isFocused ? pantry?.id : undefined);

  // Consume item mutation
  const [createPantryItemUsage] = useCreatePantryItemUsageMutation({
    errorPolicy: 'all',
    onError: error => {
      console.error('Failed to create pantry item usage:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to record item consumption. Please try again.',
      );
    },
  });

  // Waste item mutation
  const [recordPantryItemWaste] = useRecordPantryItemWasteMutation({
    errorPolicy: 'all',
    onError: error => {
      console.error('Failed to record pantry item waste:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to record waste. Please try again.',
      );
    },
  });

  // Restock item mutation
  const [restockPantryItem] = useRestockPantryItemMutation({
    errorPolicy: 'all',
    onError: error => {
      console.error('Failed to restock pantry item:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to restock item. Please try again.',
      );
    },
  });


  // Handler to confirm consumption
  const handleConfirmConsume = useCallback(
    async (
      quantityUsed: number,
      quantityInput: string,
      purpose: UsagePurpose,
      notes: string,
      usageUnitId?: string,
      weightUsed?: number,
      weightUsedUnitId?: string,
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
              usageUnitId,
              weightUsed,
              weightUsedUnitId,
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
    },
    [selectedItemForConsume, createPantryItemUsage, refetch],
  );

  // Handler to close consume modal
  const handleCloseConsumeModal = useCallback(() => {
    setConsumeModalVisible(false);
    setSelectedItemForConsume(null);
  }, []);


  // Handler to confirm waste recording
  const handleConfirmWaste = useCallback(
    async (
      wasteAmount: number,
      wasteReason: WasteReason,
      isComposted: boolean,
      isRecycled: boolean,
      _notes: string,
      wasteUnitId?: string,
      wasteWeight?: number,
      wasteWeightUnitId?: string,
    ) => {
      if (!selectedItemForWaste) return;

      try {
        await recordPantryItemWaste({
          variables: {
            id: selectedItemForWaste.id,
            wasteAmount,
            wasteReason,
            wasteUnitId,
            wasteWeight,
            wasteWeightUnitId,
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
    },
    [selectedItemForWaste, recordPantryItemWaste, refetch],
  );

  // Handler to close waste modal
  const handleCloseWasteModal = useCallback(() => {
    setWasteModalVisible(false);
    setSelectedItemForWaste(null);
  }, []);


  // Handler to confirm restock
  const handleConfirmRestock = useCallback(
    async (
      quantity: number,
      _quantityInput: string,
      notes: string,
      unitId?: string,
      weight?: number,
      weightUnitId?: string,
    ) => {
      if (!selectedItemForRestock) return;

      try {
        await restockPantryItem({
          variables: {
            id: selectedItemForRestock.id,
            input: {
              quantity,
              unitId,
              weight,
              weightUnitId,
              notes: notes || undefined,
            },
          },
        });

        // Reset state
        setRestockModalVisible(false);
        setSelectedItemForRestock(null);

        // Refetch to get updated quantities
        await refetch();
      } catch (error) {
        console.error('Error restocking pantry item:', error);
      }
    },
    [selectedItemForRestock, restockPantryItem, refetch],
  );

  // Handler to close restock modal
  const handleCloseRestockModal = useCallback(() => {
    setRestockModalVisible(false);
    setSelectedItemForRestock(null);
  }, []);

  // Handler to open consume modal (for swipe action)
  const handleConsumeItem = useCallback(
    (itemId: string) => {
      const item = pantryItems.find(p => p.id === itemId);
      if (item) {
        setSelectedItemForConsume(item);
        setConsumeModalVisible(true);
      }
    },
    [pantryItems],
  );

  // Handler to open waste modal (for swipe action)
  const handleWasteItem = useCallback(
    (itemId: string) => {
      const item = pantryItems.find(p => p.id === itemId);
      if (item) {
        setSelectedItemForWaste(item);
        setWasteModalVisible(true);
      }
    },
    [pantryItems],
  );

  // Handler to open restock modal (for swipe action)
  const handleRestockItem = useCallback(
    (itemId: string) => {
      const item = pantryItems.find(p => p.id === itemId);
      if (item) {
        setSelectedItemForRestock(item);
        setRestockModalVisible(true);
      }
    },
    [pantryItems],
  );

  // Handler to edit item (for swipe action)
  const handleEditItem = useCallback(
    (itemId: string) => {
      navigateTo.pantryItem({ itemId });
    },
    [navigateTo],
  );

  // Handler to delete item (for swipe action)
  const handleDeleteItem = useCallback(
    async (itemId: string) => {
      try {
        await removeItem(itemId);
      } catch (error) {
        console.error('Error deleting pantry item:', error);
      }
    },
    [removeItem],
  );

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

  // Filter items by location for redesigned tabs
  const locationFilteredItems = useMemo(() => {
    if (locationFilter === 'all') return pantryItems;

    const storageStateMap: Record<LocationFilter, StorageState | undefined> = {
      all: undefined,
      fridge: StorageState.Refrigerated,
      freezer: StorageState.Frozen,
      pantry: StorageState.Ambient,
    };

    const targetState = storageStateMap[locationFilter];
    return pantryItems.filter((item: any) => {
      if (locationFilter === 'pantry') {
        return item.storageState === StorageState.Ambient || !item.storageState;
      }
      return item.storageState === targetState;
    });
  }, [pantryItems, locationFilter]);

  // Handle location filter change
  const handleLocationFilterChange = useCallback((filter: LocationFilter) => {
    setLocationFilter(filter);
  }, []);

  // Track screen view on mount
  useEffect(() => {
    Telemetry.trackScreen('PantryMain', {
      home_id: selectedHomeId,
      pantry_id: pantry?.id,
      item_count: locationFilteredItems.length,
      has_pantries: (currentHomeData?.home?.pantries?.length || 0) > 0,
    });
  }, [
    selectedHomeId,
    pantry?.id,
    locationFilteredItems.length,
    currentHomeData?.home?.pantries?.length,
  ]);

  // Show home switch hint when user has items and home is selected
  // BUT only if biometric setup modal is not showing (prevent modal overlap)
  useEffect(() => {
    if (
      selectedHomeId &&
      locationFilteredItems.length > 0 &&
      !homeSwitchHint.hasBeenShown &&
      !showBiometricSetup
    ) {
      // Show hint after a delay to let UI settle
      const timer = setTimeout(() => {
        homeSwitchHint.show();
      }, 2000); // 2 seconds delay
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    locationFilteredItems.length,
    selectedHomeId,
    homeSwitchHint.hasBeenShown,
    homeSwitchHint.show,
    showBiometricSetup,
  ]);


  const handleRefresh = async () => {
    await Promise.all([refetch(), refetchHome()]);
  };

  // Determine loading state - only show loading if we have no data at all
  const isLoadingInitial =
    loading && locationFilteredItems.length === 0 && !allItems?.length;

  // Get user display name and avatar
  const userName =
    profile?.displayName || profile?.firstName || profile?.lastName || 'there';
  const avatarInitial = userName.charAt(0).toUpperCase();
  const householdName = currentHomeData?.home?.name || 'Your Home';

  // Sectioned items for redesigned content - filter based on location
  const filteredExpiringSoonItems = useMemo(() => {
    if (locationFilter === 'all') return sectionedItems.expiringSoonItems;

    const storageStateMap: Record<LocationFilter, StorageState | undefined> = {
      all: undefined,
      fridge: StorageState.Refrigerated,
      freezer: StorageState.Frozen,
      pantry: StorageState.Ambient,
    };

    const targetState = storageStateMap[locationFilter];
    return sectionedItems.expiringSoonItems.filter((item: any) => {
      if (locationFilter === 'pantry') {
        return item.storageState === StorageState.Ambient || !item.storageState;
      }
      return item.storageState === targetState;
    });
  }, [sectionedItems.expiringSoonItems, locationFilter]);

  const filteredNormalItems = useMemo(() => {
    if (locationFilter === 'all') return sectionedItems.normalItems;

    const storageStateMap: Record<LocationFilter, StorageState | undefined> = {
      all: undefined,
      fridge: StorageState.Refrigerated,
      freezer: StorageState.Frozen,
      pantry: StorageState.Ambient,
    };

    const targetState = storageStateMap[locationFilter];
    return sectionedItems.normalItems.filter((item: any) => {
      if (locationFilter === 'pantry') {
        return item.storageState === StorageState.Ambient || !item.storageState;
      }
      return item.storageState === targetState;
    });
  }, [sectionedItems.normalItems, locationFilter]);

  return (
    <View style={styles.container} testID="pantry-screen">
      {isLoadingInitial && <View testID="pantry-loading" />}
      <PantryRedesignedContent
        userName={userName}
        householdName={householdName}
        avatarInitial={avatarInitial}
        avatarUrl={profile?.avatar}
        notificationCount={stats.expired + stats.lowStock}
        items={locationFilteredItems}
        expiredCount={stats.expired}
        expiringSoonItems={filteredExpiringSoonItems}
        normalItems={filteredNormalItems}
        locationFilter={locationFilter}
        onLocationFilterChange={handleLocationFilterChange}
        locationCounts={locationCounts}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onItemPress={id => navigateTo.pantryItemDetail({ itemId: id })}
        onItemEdit={handleEditItem}
        onItemDelete={handleDeleteItem}
        onItemConsume={handleConsumeItem}
        onItemWaste={handleWasteItem}
        onItemRestock={handleRestockItem}
        onExpiredBannerPress={() => navigate('ExpiringItems')}
        onAvatarPress={() => navigate('Notifications')}
        onHomePress={() => navigate('HomeManagement', { homeId: selectedHomeId })}
        onSettingsPress={handleOpenSelector}
        onRefresh={handleRefresh}
        onEndReached={loadMore}
        refreshing={loading}
        loading={isLoadingInitial}
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
      <RestockPantryItemModal
        visible={restockModalVisible}
        pantryItem={selectedItemForRestock}
        onClose={handleCloseRestockModal}
        onConfirm={handleConfirmRestock}
      />

      {/* Home switch hint overlay */}
      {homeSwitchHint.isVisible && (
        <FeatureHintOverlay
          config={{
            title: 'Tap to manage homes',
            subtitle:
              'Click the home icon to switch between homes or manage home settings',
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
});

// PERFORMANCE: Screen-level error boundary prevents full app reset on mutation failures
export const PantryMain: React.FC = () => (
  <PantryErrorBoundary>
    <PantryMainScreen />
  </PantryErrorBoundary>
);

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
}));
