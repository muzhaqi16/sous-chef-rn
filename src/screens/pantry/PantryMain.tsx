import React, {
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  startTransition,
} from 'react';
import { View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApolloClient } from '@apollo/client/react';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useTabBarAddButton } from '#hooks/navigation/useTabBarAddButton';
import { useUnistyles, StyleSheet } from 'react-native-unistyles';
import { usePantryManagement } from '#hooks/home/pantry/usePantryManagement';
import { usePantrySelectorConfig } from '#hooks/pantry/usePantrySelectorConfig';
import { usePantryItemActions } from '#hooks/pantry/usePantryItemActions';
import { useCurrentPantry } from '#hooks/pantry/useCurrentPantry';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { useScannerSetup } from '#hooks/scanner/useScannerSetup';
import { useSelectorManagement } from '#hooks/ui/useSelectorManagement';
import { useSwipeableCoordinator } from '#hooks/ui/useSwipeableCoordinator';
import { useAppStore } from '#store/useAppStore';
import { useShallow } from 'zustand/shallow';
import { useGetHomeQuery, GetStorageLocationsQuery, StorageState } from '#generated';
import { useTabBarSetters } from '#/context/TabBarActionsContext';
import { useFeatureHint } from '#hooks/useFeatureHint';
import { FeatureHintOverlay } from '#/components/organisms/FeatureHintOverlay';
import { useScreenTelemetry } from '#hooks/performance/useScreenTelemetry';
import { Telemetry } from '#services/telemetry';
import { useAuth } from '#hooks/auth/useAuth';
import type { LocationFilter } from '#/utils/pantryFilters';
import { AnimatedItemSelector } from '#components/organisms/AnimatedItemSelector/AnimatedItemSelector';
import { PantryContent, type PantryContentRef } from '#components/pantry/PantryContent';
import { ConsumePantryItemModal } from '#components/modals/ConsumePantryItemModal';
import { RecordWastePantryItemModal } from '#components/modals/RecordWastePantryItemModal';
import { RestockPantryItemModal } from '#components/modals/RestockPantryItemModal';
import { AddToPantrySheet } from '#components/modals/AddToPantrySheet/AddToPantrySheet';
import { AddStorageLocationSheet } from '#components/modals/AddStorageLocationSheet/AddStorageLocationSheet';
import type { ItemSelectorRef } from '#components/organisms/AnimatedItemSelector/types';
import { PantryErrorBoundary } from '#/components/providers/ScreenErrorBoundary';
import { useStorageLocationManagement } from '#hooks/storageLocation/useStorageLocationManagement';
import type { FilterTabConfig } from '#components/molecules/FilterTabs/types';
const PantryMainScreen: React.FC = () => {
  const { navigate, navigateTo } = useAppNavigation();
  useUnistyles();
  const { setOverlayOpen } = useTabBarSetters();
  // PERF: Defer non-critical features until after React paints the initial render.
  // React 19's useDeferredValue returns `false` on first render (initial value),
  // then schedules a background re-render returning `true` to activate deferred features.
  const isInteractive = useDeferredValue(true, false);
  // User name/avatar come from the auth store (populated during login)
  // so the greeting renders immediately without a separate GetUserProfile query
  const { user: authUser } = useAuth();
  // Track screen performance (deferred — telemetry not needed during initial render)
  useScreenTransition('PantryMain', { enabled: isInteractive });
  // Feature hint for home switch button
  const homeSwitchHint = useFeatureHint({
    featureId: 'pantry_home_switch',
    showOnMount: false, // We'll manually trigger when appropriate
  });
  // PERF: Single consolidated selector reduces from 8 store subscriptions to 1.
  // On every Zustand store update, only 1 subscriber callback fires (with shallow
  // comparison) instead of 8 separate callbacks each running Object.is.
  const {
    showBiometricSetup,
    unreadCount,
    pantrySortOption,
    pantrySortDirection,
    setPantrySortOption,
    setPantrySortDirection,
    pendingPantryScrollToTop,
    setPendingPantryScrollToTop,
  } = useAppStore(useShallow(s => ({
    showBiometricSetup: s.showBiometricSetup,
    unreadCount: s.unreadCount,
    pantrySortOption: s.pantrySortOption ?? 'recent',
    pantrySortDirection: s.pantrySortDirection ?? 'desc',
    setPantrySortOption: s.setPantrySortOption,
    setPantrySortDirection: s.setPantrySortDirection,
    pendingPantryScrollToTop: s.pendingPantryScrollToTop,
    setPendingPantryScrollToTop: s.setPendingPantryScrollToTop,
  })));
  // Callback to persist sort changes to store (defensive - check functions exist)
  const handleSortChange = 
    (
      option: 'name' | 'expiry' | 'quantity' | 'recent',
      direction: 'asc' | 'desc',
    ) => {
      setPantrySortOption?.(option);
      setPantrySortDirection?.(direction);
    };
  const selectorRef = useRef<ItemSelectorRef>(null);
  const pantryContentRef = useRef<PantryContentRef>(null);
  const pendingPantryScrollToTopRef = useRef(pendingPantryScrollToTop);
  const client = useApolloClient();
  const itemsAddedRef = useRef(false);
  const handleItemAdded = () => {
    itemsAddedRef.current = true;
    // Background sync: silently refetch pantry to ensure cache consistency
    client.refetchQueries({ include: ['GetPantry'] });
  };
  const handleAddSheetClose = () => {
    const shouldScroll = itemsAddedRef.current;
    itemsAddedRef.current = false;
    setAddSheetVisible(false);
    if (shouldScroll) {
      pantryContentRef.current?.scrollToTop();
    }
  };
  useEffect(() => {
    pendingPantryScrollToTopRef.current = pendingPantryScrollToTop;
  }, [pendingPantryScrollToTop]);

  const [onPantryFocus] = useState(() => () => {
    if (pendingPantryScrollToTopRef.current) {
      pantryContentRef.current?.scrollToTop();
      setPendingPantryScrollToTop(false);
    }
  });

  // Scroll to top when returning from barcode scanner after adding an item
  useFocusEffect(onPantryFocus);
  // Location filter for redesigned tabs
  const [locationFilter, setLocationFilter] = useState<LocationFilter>('all');
  // Add to pantry sheet state
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  // Add storage location sheet state
  const [addLocationSheetVisible, setAddLocationSheetVisible] = useState(false);
  // Manage selector with overlay coordination
  const { handleOpenSelector, handleOverlayOpen, handleOverlayClose } =
    useSelectorManagement({
      selectorRef,
      setOverlayOpen,
    });
  // Coordinate swipeable items so only one is open at a time
  const { handleSwipeableWillOpen, handleSwipeableClose } = useSwipeableCoordinator();
  // Centralized pantry selection with fallback chain
  const {
    pantry,
    pantries,
    currentHome,
    selectedHomeId,
    setSelectedPantryId,
    isReady,
  } = useCurrentPantry();
  // Keep query for pull-to-refresh
  // Gate query with isReady to prevent firing before home selection is complete
  // freezeOnBlur handles suppressing updates when screen is not focused
  const shouldFetchHome =
    isInteractive && isReady && !!selectedHomeId && !currentHome;
  const { refetch: refetchHome } = useGetHomeQuery({
    variables: { homeId: selectedHomeId! },
    skip: !shouldFetchHome,
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
  });
  // Set up scanner button (deferred — scanner not needed during initial render)
  useScannerSetup({
    enabled: isInteractive,
    homeId: selectedHomeId,
    context: {
      source: 'pantry',
      pantryId: pantry?.id,
    },
  });
  // Register add button action - open add to pantry sheet
  useTabBarAddButton(() => {
    Telemetry.trackEvent('add_pantry_item_clicked');
    setAddSheetVisible(true);
  });
  const {
    items: rawPantryItems,
    allItems,
    stats,
    totalCount,
    searchQuery,
    setSearchQuery,
    removeItem,
    refetch,
    loading,
    isRefreshing,
    error: pantryError,
    loadMore,
    locationCounts,
  } = usePantryManagement(pantry?.id);
  // PERF: Defer pantry items so Apollo cache updates (from subscriptions or
  // fetchMore) don't block user interactions like scrolling and tapping.
  // Downstream memos (locationFilteredItems → sortedItems → itemDisplayMap)
  // will only recompute when React has idle time.
  const pantryItems = useDeferredValue(rawPantryItems);
  // PERF: Defer storage locations until pantry data has loaded (data-driven)
  // Default tabs (All/Fridge/Freezer/Pantry) show immediately; custom tabs appear after pantry loads
  const storageLocationsReady = !loading && isReady;
  const {
    locations: storageLocations,
    createLocation,
    creating: creatingLocation,
  } = useStorageLocationManagement(storageLocationsReady ? selectedHomeId ?? undefined : undefined);
  // Stable navigateTo wrapper for usePantryItemActions
  const stableNavigateTo = ({ pantryItem: (params: { itemId: string }) => navigateTo.pantryItem(params) });
  // Extract item actions (modal state + mutations + handlers) to separate hook
  const {
    consumeModal,
    wasteModal,
    restockModal,
    handleConfirmConsume,
    handleConfirmWaste,
    handleConfirmRestock,
    handleConsumeItem,
    handleWasteItem,
    handleRestockItem,
    handleEditItem,
    handleDeleteItem,
  } = usePantryItemActions({
    pantryItems,
    removeItem,
    navigateTo: stableNavigateTo,
  });
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
  });
  // Create selector configuration for pantries
  const pantryConfig = usePantrySelectorConfig({
    pantries,
    selectedPantryId: pantry?.id,
    loading,
    setSelectedPantryId,
    selectorRef,
    navigate,
  });
  // PERFORMANCE: Synchronous filter to ensure FlashList always receives stable data.
  // Short-circuit for 'all' returns the original pantryItems reference — prevents
  // unnecessary downstream recomputation (sortedItems → itemDisplayMap → FlashList).
  const locationFilteredItems = (() => {
      if (locationFilter === 'all') return pantryItems;
      return pantryItems.filter(item => {
        switch (locationFilter) {
          case 'fridge':
            return item.storageState === StorageState.Refrigerated;
          case 'freezer':
            return item.storageState === StorageState.Frozen;
          case 'pantry':
            return item.storageState === StorageState.Ambient || !item.storageState;
          default:
            // Custom storage location filter
            return item.storageLocation?.id === locationFilter;
        }
      });
    })();
  // Handle location filter change
  const handleLocationFilterChange = (filter: LocationFilter) => {
    startTransition(() => {
      setLocationFilter(filter);
    });
  };
  // Build combined tabs: default temperature tabs + custom storage locations
  const defaultTabs: FilterTabConfig<LocationFilter>[] = [
    { id: 'all', label: 'All' },
    { id: 'fridge', label: 'Fridge', icon: 'thermometer-outline' },
    { id: 'freezer', label: 'Freezer', icon: 'snow-outline' },
    { id: 'pantry', label: 'Pantry', icon: 'cube-outline' },
  ];
  // Add custom storage locations as tabs
  type StorageLocation = GetStorageLocationsQuery['storageLocations']['edges'][number]['node'];
  const customTabs: FilterTabConfig<LocationFilter>[] = storageLocations.map(
    (location: StorageLocation) => ({
      id: location.id,
      label: location.name,
      icon: location.icon ?? undefined,
    }),
  );
  const combinedTabs: FilterTabConfig<LocationFilter>[] = [...defaultTabs, ...customTabs];
  // Handle add storage location
  const handleAddLocationPress = () => {
    setAddLocationSheetVisible(true);
  };
  // Handle add item from empty state
  const handleAddItem = () => {
    setAddSheetVisible(true);
  };
  // Track screen view once on mount (deferred — telemetry not needed during initial render)
  useScreenTelemetry('PantryMain', () => ({
    home_id: selectedHomeId,
    pantry_id: pantry?.id,
    item_count: locationFilteredItems.length,
    has_pantries: pantries.length > 0,
  }), isInteractive);
  // Show home switch hint when user has items and home is selected
  // BUT only if biometric setup modal is not showing (prevent modal overlap)
  useEffect(() => {
    if (!isInteractive) return;
    if (
      selectedHomeId &&
      locationFilteredItems.length > 0 &&
      !homeSwitchHint.hasBeenShown &&
      !showBiometricSetup
    ) {
      // Show hint after a delay to let UI settle
      const timer = setTimeout(() => {
        homeSwitchHint.actions.show();
      }, 2000); // 2 seconds delay
      return () => clearTimeout(timer);
    }
  }, [
    isInteractive,
    locationFilteredItems.length,
    selectedHomeId,
    homeSwitchHint.hasBeenShown,
    homeSwitchHint.actions,
    showBiometricSetup,
  ]);
  const handleItemPress = (id: string) => navigateTo.pantryItemDetail({ itemId: id });
  const handleAvatarPress = () => navigate('Profile');
  const handleNotificationPress = () => navigate('Notifications');
  const handleHomePress = () => navigate('HomeManagement', { homeId: selectedHomeId });
  const handleAnalyticsPress = () => {
      if (pantry?.id) {
        navigate('PantryAnalytics', { pantryId: pantry.id });
      }
    };
  const handleLowStockNavigate = () => navigate('LowStockItems');
  const handleRefresh = async () => {
    await Promise.all([refetch(), refetchHome()]);
  };
  // Determine loading state - only show loading if we have no data at all and no error
  // If there's an error, stop showing loading state to prevent infinite spinner
  // Also show loading while home selection is initializing
  const isLoadingInitial =
    (!isReady || loading) &&
    !pantryError &&
    locationFilteredItems.length === 0 &&
    !allItems?.length;
  // isRefreshing comes from usePantryManagement (manual tracking in usePantryQuery)
  // Get user display name and avatar from auth store (populated at login)
  const userName =
    authUser?.name || authUser?.firstName || authUser?.lastName || 'there';
  const householdName = currentHome?.name || 'Your Home';
  return (
    <View style={styles.container} testID="pantry-screen">
      <PantryContent
        ref={pantryContentRef}
        userName={userName}
        householdName={householdName}
        avatarUrl={authUser?.profilePicture}
        notificationCount={unreadCount}
        stats={stats}
        items={locationFilteredItems}
        locationFilter={locationFilter}
        onLocationFilterChange={handleLocationFilterChange}
        locationCounts={locationCounts}
        tabs={combinedTabs}
        onAddLocation={handleAddLocationPress}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        initialSortOption={pantrySortOption}
        initialSortDirection={pantrySortDirection}
        onSortChange={handleSortChange}
        onItemPress={handleItemPress}
        onItemEdit={handleEditItem}
        onItemDelete={handleDeleteItem}
        onItemConsume={handleConsumeItem}
        onItemWaste={handleWasteItem}
        onItemRestock={handleRestockItem}
        onAvatarPress={handleAvatarPress}
        onNotificationPress={handleNotificationPress}
        onHomePress={handleHomePress}
        onSettingsPress={handleOpenSelector}
        onAnalyticsPress={handleAnalyticsPress}
        onLowStockNavigate={handleLowStockNavigate}
        totalCount={totalCount}
        onAddItem={handleAddItem}
        onRefresh={handleRefresh}
        onEndReached={loadMore}
        refreshing={isRefreshing}
        loading={isLoadingInitial}
        onSwipeableWillOpen={handleSwipeableWillOpen}
        onSwipeableClose={handleSwipeableClose}
      />
      <AnimatedItemSelector
        ref={selectorRef}
        config={pantryConfig}
        onOpen={handleOverlayOpen}
        onClose={handleOverlayClose}
      />
      {!!consumeModal.visible && (
        <ConsumePantryItemModal
          visible={consumeModal.visible}
          pantryItem={consumeModal.item}
          onClose={consumeModal.close}
          onConfirm={handleConfirmConsume}
        />
      )}
      {!!wasteModal.visible && (
        <RecordWastePantryItemModal
          visible={wasteModal.visible}
          pantryItem={wasteModal.item}
          onClose={wasteModal.close}
          onConfirm={handleConfirmWaste}
        />
      )}
      {!!restockModal.visible && (
        <RestockPantryItemModal
          visible={restockModal.visible}
          pantryItem={restockModal.item}
          onClose={restockModal.close}
          onConfirm={handleConfirmRestock}
        />
      )}
      {/* Add to Pantry Sheet */}
      {!!addSheetVisible && (
        <AddToPantrySheet
          visible={addSheetVisible}
          pantryId={pantry?.id}
          onClose={handleAddSheetClose}
          onItemAdded={handleItemAdded}
        />
      )}
      {/* Add Storage Location Sheet */}
      {!!addLocationSheetVisible && (
        <AddStorageLocationSheet
          visible={addLocationSheetVisible}
          onClose={() => setAddLocationSheetVisible(false)}
          onCreateLocation={createLocation}
          creating={creatingLocation}
        />
      )}
      {/* Home switch hint overlay */}
      {!!homeSwitchHint.isVisible && (
        <FeatureHintOverlay
          config={{
            title: 'Tap to manage homes',
            subtitle:
              'Click the home icon to switch between homes or manage home settings',
            icon: {
              name: 'swap-horizontal-outline',
              size: 40,
            },
            onDismiss: homeSwitchHint.actions.dismiss,
          }}
        />
      )}
    </View>
  );
};
// PERFORMANCE: Screen-level error boundary prevents full app reset on mutation failures
export const PantryMain: React.FC = () => (
  <PantryErrorBoundary>
    <PantryMainScreen />
  </PantryErrorBoundary>
);
const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    paddingTop: theme.spacing.sm,
    backgroundColor: theme.colors.background,
  },
}));
