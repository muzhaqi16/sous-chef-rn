import React, {
  useMemo,
  useEffect,
  useCallback,
  useRef,
  useState,
} from 'react';
import { View } from 'react-native';
import { NetworkStatus } from '@apollo/client';
import { useAppNavigation } from '#hooks';
import { useUnistyles, StyleSheet } from 'react-native-unistyles';
import { usePantryManagement, usePantrySelectorConfig } from '#hooks';
import { usePantryItemActions, useCurrentPantry } from '#hooks/pantry';
import { useScreenTransition } from '#hooks/performance';
import { useScannerSetup } from '#hooks/scanner';
import { useSelectorManagement } from '#hooks/ui';
import { useAppStore } from '#store/useAppStore';
import { useStore } from '#store';
import { useGetHomeBasicQuery } from '#generated';
import { useTabBarActions } from '#context';
import { useFeatureHint } from '#/hooks/useFeatureHint';
import { FeatureHintOverlay } from '#/components/organisms/FeatureHintOverlay';
import { Telemetry } from '#/services/telemetry';
import { useProfileData } from '#hooks/profile/useProfileData';
import { filterByLocation, LocationFilter } from '#/utils/pantryFilters';

import { AnimatedItemSelector } from '#components';
import { PantryContent } from '#components/pantry';
import { ConsumePantryItemModal } from '#components/modals/ConsumePantryItemModal';
import { RecordWastePantryItemModal } from '#components/modals/RecordWastePantryItemModal';
import { RestockPantryItemModal } from '#components/modals/RestockPantryItemModal';
import { AddToPantrySheet } from '#components/modals/AddToPantrySheet';
import type { ItemSelectorRef } from '#components/organisms/AnimatedItemSelector';
import { PantryErrorBoundary } from '#/components/providers/ScreenErrorBoundary';

// PERFORMANCE: Memoize screen component to prevent unnecessary re-renders
const PantryMainScreen: React.FC = React.memo(() => {
  const { navigate, navigateTo, isFocused } = useAppNavigation();
  useUnistyles();
  const { setOverlayOpen, setAddProps } = useTabBarActions();

  // Get user profile for greeting
  const { profile } = useProfileData();

  // Track screen performance
  useScreenTransition('PantryMain');

  // Feature hint for home switch button
  const homeSwitchHint = useFeatureHint({
    featureId: 'pantry_home_switch',
    showOnMount: false, // We'll manually trigger when appropriate
  });

  const showBiometricSetup = useAppStore(state => state.showBiometricSetup);
  const unreadCount = useStore(state => state.unreadCount);

  // Pantry sort preferences from store
  const pantrySortOption = useAppStore(s => s.pantrySortOption) ?? 'recent';
  const pantrySortDirection = useAppStore(s => s.pantrySortDirection) ?? 'desc';
  const setPantrySortOption = useAppStore(s => s.setPantrySortOption);
  const setPantrySortDirection = useAppStore(s => s.setPantrySortDirection);

  // Callback to persist sort changes to store (defensive - check functions exist)
  const handleSortChange = useCallback(
    (
      option: 'name' | 'expiry' | 'quantity' | 'recent',
      direction: 'asc' | 'desc',
    ) => {
      setPantrySortOption?.(option);
      setPantrySortDirection?.(direction);
    },
    [setPantrySortOption, setPantrySortDirection],
  );

  const selectorRef = useRef<ItemSelectorRef>(null);

  // Location filter for redesigned tabs
  const [locationFilter, setLocationFilter] = useState<LocationFilter>('all');

  // Add to pantry sheet state
  const [addSheetVisible, setAddSheetVisible] = useState(false);

  // Manage selector with overlay coordination
  const { handleOpenSelector, handleOverlayOpen, handleOverlayClose } =
    useSelectorManagement({
      selectorRef,
      setOverlayOpen,
    });

  // Centralized pantry selection with fallback chain
  const { pantry, pantries, currentHome, selectedHomeId, setSelectedPantryId } =
    useCurrentPantry();

  // Keep query for pull-to-refresh
  const { refetch: refetchHome } = useGetHomeBasicQuery({
    variables: { homeId: selectedHomeId ?? '' },
    skip: !selectedHomeId || !!currentHome,
    fetchPolicy: 'cache-and-network',
  });

  // Set up scanner button
  useScannerSetup({
    enabled: true,
    homeId: selectedHomeId,
    context: {
      source: 'pantry',
      pantryId: pantry?.id,
    },
  });

  // Register add button action - open add to pantry sheet
  useEffect(() => {
    if (isFocused) {
      setAddProps(() => setAddSheetVisible(true), true);
    }
    return () => {
      setAddProps(undefined, false);
    };
  }, [isFocused, setAddProps]);

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
    networkStatus,
    error: pantryError,
    loadMore,
    locationCounts,
    sectionedItems,
  } = usePantryManagement(isFocused ? pantry?.id : undefined);

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
    refetch,
    removeItem,
    navigateTo: { pantryItem: params => navigateTo.pantryItem(params) },
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
  }, [pantry?.id, refetch]);

  // Create selector configuration for pantries
  const pantryConfig = usePantrySelectorConfig({
    pantries,
    selectedPantryId: pantry?.id,
    loading,
    setSelectedPantryId,
    selectorRef,
    navigate,
  });

  // Filter items by location for redesigned tabs (using shared utility)
  const locationFilteredItems = useMemo(
    () => filterByLocation(pantryItems, locationFilter),
    [pantryItems, locationFilter],
  );

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
      has_pantries: pantries.length > 0,
    });
  }, [
    selectedHomeId,
    pantry?.id,
    locationFilteredItems.length,
    pantries.length,
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

  // Determine loading state - only show loading if we have no data at all and no error
  // If there's an error, stop showing loading state to prevent infinite spinner
  const isLoadingInitial =
    loading &&
    !pantryError &&
    locationFilteredItems.length === 0 &&
    !allItems?.length;

  // Only show refreshing indicator during explicit user-initiated pull-to-refresh
  // Background fetches from cache-and-network are silent to avoid loading flash on navigation
  const isRefreshing = networkStatus === NetworkStatus.refetch;

  // Get user display name and avatar
  const userName =
    profile?.displayName || profile?.firstName || profile?.lastName || 'there';
  const householdName = currentHome?.name || 'Your Home';

  // Sectioned items for redesigned content - filter based on location (using shared utility)
  const filteredExpiringSoonItems = useMemo(
    () => filterByLocation(sectionedItems.expiringSoonItems, locationFilter),
    [sectionedItems.expiringSoonItems, locationFilter],
  );

  const filteredNormalItems = useMemo(
    () => filterByLocation(sectionedItems.normalItems, locationFilter),
    [sectionedItems.normalItems, locationFilter],
  );

  return (
    <View style={styles.container} testID="pantry-screen">
      {isLoadingInitial && <View testID="pantry-loading" />}
      <PantryContent
        userName={userName}
        householdName={householdName}
        avatarUrl={profile?.avatar}
        notificationCount={unreadCount}
        items={locationFilteredItems}
        expiredCount={stats.expired}
        expiringSoonItems={filteredExpiringSoonItems}
        normalItems={filteredNormalItems}
        locationFilter={locationFilter}
        onLocationFilterChange={handleLocationFilterChange}
        locationCounts={locationCounts}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        initialSortOption={pantrySortOption}
        initialSortDirection={pantrySortDirection}
        onSortChange={handleSortChange}
        onItemPress={id => navigateTo.pantryItemDetail({ itemId: id })}
        onItemEdit={handleEditItem}
        onItemDelete={handleDeleteItem}
        onItemConsume={handleConsumeItem}
        onItemWaste={handleWasteItem}
        onItemRestock={handleRestockItem}
        onExpiredBannerPress={() => navigate('ExpiringItems')}
        onAvatarPress={() => navigate('Notifications')}
        onHomePress={() =>
          navigate('HomeManagement', { homeId: selectedHomeId })
        }
        onSettingsPress={handleOpenSelector}
        onRefresh={handleRefresh}
        onEndReached={loadMore}
        refreshing={isRefreshing}
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
        visible={consumeModal.visible}
        pantryItem={consumeModal.item}
        onClose={consumeModal.close}
        onConfirm={handleConfirmConsume}
      />
      <RecordWastePantryItemModal
        visible={wasteModal.visible}
        pantryItem={wasteModal.item}
        onClose={wasteModal.close}
        onConfirm={handleConfirmWaste}
      />
      <RestockPantryItemModal
        visible={restockModal.visible}
        pantryItem={restockModal.item}
        onClose={restockModal.close}
        onConfirm={handleConfirmRestock}
      />

      {/* Add to Pantry Sheet */}
      <AddToPantrySheet
        visible={addSheetVisible}
        pantryId={pantry?.id}
        onClose={() => setAddSheetVisible(false)}
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
    paddingTop: theme.spacing.sm,
    backgroundColor: theme.colors.background,
  },
}));
