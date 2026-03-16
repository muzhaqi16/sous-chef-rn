import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useTabBarAddButton } from '#hooks/navigation/useTabBarAddButton';
import { StyleSheet } from 'react-native-unistyles';
import { usePantrySelectorConfig } from '#hooks/pantry/usePantrySelectorConfig';
import { useScannerSetup } from '#hooks/scanner/useScannerSetup';
import { useSelectorManagement } from '#hooks/ui/useSelectorManagement';
import {
  useTabBarSetters,
  useTabBarState,
} from '#/context/TabBarActionsContext';
import { SpotlightCoachMark } from '#/components/organisms/SpotlightCoachMark/SpotlightCoachMark';
import {
  useTutorialSequence,
  type TutorialStep,
} from '#hooks/ui/useTutorialSequence';
import { Telemetry } from '#services/telemetry';
import { useStore } from '#store';
import { usePantryScreen } from '#hooks/pantry/usePantryScreen';
import { useTabScreenLifecycle } from '#hooks/performance/useTabScreenLifecycle';
import {
  PantryModalsProvider,
  usePantryModals,
} from '#/context/PantryModalsContext';
import { AnimatedItemSelector } from '#components/organisms/AnimatedItemSelector/AnimatedItemSelector';
import {
  PantryContent,
  type PantryContentRef,
} from '#components/pantry/PantryContent';
import type { ItemSelectorRef } from '#components/organisms/AnimatedItemSelector/types';
import type { LocationFilter } from '#/utils/pantryFilters';
import { PantryErrorBoundary } from '#/components/providers/ScreenErrorBoundary';
import type { FilterTabConfig } from '#components/molecules/FilterTabs/types';
import { DeferredScreen } from '#components/performance/DeferredScreen';
import { PantryScreenSkeleton } from '#components/base/Skeleton/PantryScreenSkeleton';
import { TabScreenHeader } from '#components/molecules/TabScreenHeader';
import { SearchBar } from '#components/molecules/SearchBar';
import { FilterTabs } from '#components/molecules/FilterTabs/FilterTabs';
import { SectionHeader } from '#components/molecules/SectionHeader';

// ── Pantry tutorial steps (data-driven, add entries to extend) ──
const PANTRY_TUTORIAL_STEPS: TutorialStep[] = [
  {
    featureId: 'pantry_tutorial_home',
    title: 'Tap to manage homes',
    subtitle: 'Switch between homes or manage home settings',
    rectKey: 'homeBadge',
  },
  {
    featureId: 'pantry_tutorial_settings',
    title: 'Pantry settings',
    subtitle: 'Switch between pantry lists and create new pantries',
    rectKey: 'settingsIcon',
  },
  {
    featureId: 'pantry_tutorial_add',
    title: 'Add items quickly',
    subtitle: 'Tap + to add items to your pantry',
    rectKey: 'addButton',
  },
];

/**
 * Inner component that runs all heavy hooks.
 * Only mounts after DeferredScreen gates rendering, so the skeleton paints instantly.
 */
const PantryMainInner: React.FC = () => {
  const { navigate, navigateTo } = useAppNavigation();
  const { setOverlayOpen } = useTabBarSetters();

  // ── Facade hook: all data-fetching & state ──
  const screen = usePantryScreen();

  // ── Lifecycle: optimistic restoration, cache persistence, perf tracking ──
  useTabScreenLifecycle({
    screenName: 'PantryMain',
    optimisticTypes: ['Pantry', 'PantryItem'],
    telemetryProperties: () => ({
      home_id: screen.selectedHomeId,
      pantry_id: screen.pantry?.id,
      item_count: screen.pantryItems.length,
      has_pantries: screen.pantries.length > 0,
    }),
  });

  // ── Refs ──
  const selectorRef = useRef<ItemSelectorRef>(null);
  const pantryContentRef = useRef<PantryContentRef>(null);

  // ── Tab focus tracking + scroll-to-top on focus ──
  const [isPantryFocused, setIsPantryFocused] = useState(true);
  const [onPantryFocus] = useState(() => () => {
    setIsPantryFocused(true);
    // Scroll-to-top from barcode scanner returning
    const store = useStore.getState();
    if (store.pendingPantryScrollToTop) {
      pantryContentRef.current?.scrollToTop();
      store.setPendingPantryScrollToTop(false);
    }
    return () => setIsPantryFocused(false);
  });
  useFocusEffect(onPantryFocus);

  // ── Selector management ──
  const { handleOpenSelector, handleOverlayOpen, handleOverlayClose } =
    useSelectorManagement({ selectorRef, setOverlayOpen });

  // ── Scanner setup ──
  useScannerSetup({
    enabled: true,
    homeId: screen.selectedHomeId,
    context: { source: 'pantry', pantryId: screen.pantry?.id },
  });

  // ── Pantry selector config ──
  const pantryConfig = usePantrySelectorConfig({
    pantries: screen.pantries,
    selectedPantryId: screen.pantry?.id,
    loading: screen.loading,
    setSelectedPantryId: screen.setSelectedPantryId,
    selectorRef,
    navigate,
  });

  // Tutorial trigger conditions (passed to usePantryTutorial in PantryMainContent)
  const canStartTutorial =
    !!screen.selectedHomeId && !screen.showBiometricSetup;

  // ── Navigation callbacks ──
  const handleItemPress = (id: string) =>
    navigateTo.pantryItemDetail({ itemId: id });
  const handleAvatarPress = () => navigate('Profile');
  const handleNotificationPress = () => navigate('Notifications');
  const handleHomePress = () =>
    navigate('HomeManagement', { homeId: screen.selectedHomeId });
  const handleAnalyticsPress = () => {
    if (screen.pantry?.id) {
      navigate('PantryAnalytics', { pantryId: screen.pantry.id });
    }
  };
  const handleLowStockNavigate = () => navigate('LowStockItems');
  const handleSelectHome = () => navigate('HomeManagement', {});
  const stableNavigateTo = {
    pantryItem: (params: { itemId: string }) => navigateTo.pantryItem(params),
  };

  return (
    <PantryModalsProvider
      pantryId={screen.pantry?.id}
      pantryItems={screen.pantryItems}
      removeItem={screen.handleRemoveItem}
      navigateTo={stableNavigateTo}
      createLocation={screen.createLocation}
      creatingLocation={screen.creatingLocation}
      onScrollToTop={() => pantryContentRef.current?.scrollToTop()}
      searchQuery={screen.searchQuery}
      onSearchQueryClear={() => screen.setSearchQuery('')}
    >
      <PantryMainContent
        screen={screen}
        pantryContentRef={pantryContentRef}
        selectorRef={selectorRef}
        pantryConfig={pantryConfig}
        onItemPress={handleItemPress}
        onAvatarPress={handleAvatarPress}
        onNotificationPress={handleNotificationPress}
        onHomePress={handleHomePress}
        onSettingsPress={handleOpenSelector}
        onAnalyticsPress={handleAnalyticsPress}
        onLowStockNavigate={handleLowStockNavigate}
        onSelectHome={handleSelectHome}
        onOverlayOpen={handleOverlayOpen}
        onOverlayClose={handleOverlayClose}
        canStartTutorial={canStartTutorial}
        isPantryFocused={isPantryFocused}
      />
    </PantryModalsProvider>
  );
};

/**
 * Inner content component that has access to PantryModalsContext.
 * Separated from PantryMainInner so usePantryModals() works (it must be within the provider).
 */
interface PantryMainContentProps {
  screen: ReturnType<typeof usePantryScreen>;
  pantryContentRef: React.RefObject<PantryContentRef | null>;
  selectorRef: React.RefObject<ItemSelectorRef | null>;
  pantryConfig: ReturnType<typeof usePantrySelectorConfig>;
  onItemPress: (id: string) => void;
  onAvatarPress: () => void;
  onNotificationPress: () => void;
  onHomePress: () => void;
  onSettingsPress: () => void;
  onAnalyticsPress: () => void;
  onLowStockNavigate: () => void;
  onSelectHome: () => void;
  onOverlayOpen: () => void;
  onOverlayClose: () => void;
  canStartTutorial: boolean;
  isPantryFocused: boolean;
}

function PantryMainContent({
  screen,
  pantryContentRef,
  selectorRef,
  pantryConfig,
  onItemPress,
  onAvatarPress,
  onNotificationPress,
  onHomePress,
  onSettingsPress,
  onAnalyticsPress,
  onLowStockNavigate,
  onSelectHome,
  onOverlayOpen,
  onOverlayClose,
  canStartTutorial,
  isPantryFocused,
}: PantryMainContentProps) {
  const {
    handleConsumeItem,
    handleWasteItem,
    handleRestockItem,
    handleEditItem,
    handleDeleteItem,
    setAddSheetVisible,
    setAddLocationSheetVisible,
  } = usePantryModals();

  // Track element positions for tutorial spotlight coach-marks
  const [homeBadgeRect, setHomeBadgeRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [settingsIconRect, setSettingsIconRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const { addButtonRect, isOverlayOpen } = useTabBarState();

  // ── Tutorial orchestration ──
  const tutorial = useTutorialSequence({
    steps: PANTRY_TUTORIAL_STEPS,
    targetRects: {
      homeBadge: homeBadgeRect,
      settingsIcon: settingsIconRect,
      addButton: addButtonRect,
    },
    canStart: canStartTutorial,
    isPaused: !isPantryFocused || isOverlayOpen,
  });

  // Target press actions per tutorial step
  const tutorialTargetActions: Record<number, () => void> = {
    0: onHomePress,
    1: onSettingsPress,
    2: () => {
      Telemetry.trackEvent('add_pantry_item_clicked');
      setAddSheetVisible(true);
    },
  };

  // Register add button action via tab bar
  useTabBarAddButton(
    screen.noHomeSelected || screen.noHomes
      ? undefined
      : () => {
          Telemetry.trackEvent('add_pantry_item_clicked');
          setAddSheetVisible(true);
        },
  );

  const handleAddItem = () => {
    setAddSheetVisible(true);
  };

  const handleAddLocationPress = () => {
    setAddLocationSheetVisible(true);
  };

  return (
    <View style={styles.container} testID="pantry-screen">
      <PantryContent
        ref={pantryContentRef}
        userName={screen.userName}
        householdName={screen.householdName}
        avatarUrl={screen.authUser?.profilePicture}
        notificationCount={screen.unreadCount}
        stats={screen.stats}
        items={screen.pantryItems}
        locationFilter={screen.locationFilter}
        onLocationFilterChange={screen.handleLocationFilterChange}
        locationCounts={screen.completeCounts}
        tabs={screen.combinedTabs}
        onAddLocation={handleAddLocationPress}
        searchQuery={screen.searchQuery}
        onSearchChange={screen.setSearchQuery}
        initialSortOption={screen.pantrySortOption}
        initialSortDirection={screen.pantrySortDirection}
        onSortChange={screen.handleSortChange}
        useServerSort={screen.useServerSort}
        onItemPress={onItemPress}
        onItemEdit={handleEditItem}
        onItemDelete={handleDeleteItem}
        onItemConsume={handleConsumeItem}
        onItemWaste={handleWasteItem}
        onItemRestock={handleRestockItem}
        onAvatarPress={onAvatarPress}
        onNotificationPress={onNotificationPress}
        onHomePress={onHomePress}
        onSettingsPress={onSettingsPress}
        onAnalyticsPress={onAnalyticsPress}
        onLowStockNavigate={onLowStockNavigate}
        totalCount={screen.totalCount}
        noHomeSelected={screen.noHomeSelected}
        noHomes={screen.noHomes}
        onSelectHome={onSelectHome}
        onAddItem={handleAddItem}
        onRefresh={screen.handleRefresh}
        onEndReached={screen.loadMore}
        isLoadingMore={screen.searchActive ? false : screen.isLoadingMore}
        hasMore={screen.searchActive ? false : screen.hasMore}
        refreshing={screen.isRefreshing}
        loading={screen.isLoadingInitial}
        onHomeBadgeLayout={setHomeBadgeRect}
        onSettingsIconLayout={setSettingsIconRect}
      />
      <AnimatedItemSelector
        ref={selectorRef}
        config={pantryConfig}
        onOpen={onOverlayOpen}
        onClose={onOverlayClose}
      />
      {/* Tutorial spotlight coach-marks */}
      {tutorial.currentStep ? (
        <SpotlightCoachMark
          targetRect={tutorial.currentStep.targetRect}
          title={tutorial.currentStep.title}
          subtitle={tutorial.currentStep.subtitle}
          stepIndex={tutorial.currentStep.stepIndex}
          totalSteps={tutorial.currentStep.totalSteps}
          onDismiss={tutorial.skipAll}
          onTargetPress={() => {
            const action =
              tutorialTargetActions[tutorial.currentStep!.stepIndex];
            action?.();
            tutorial.advance();
          }}
        />
      ) : null}
    </View>
  );
}

const SKELETON_PANTRY_TABS: FilterTabConfig<LocationFilter>[] = [
  { id: 'all', label: 'All' },
  { id: 'fridge', label: 'Fridge', icon: 'thermometer-outline' },
  { id: 'freezer', label: 'Freezer', icon: 'snow-outline' },
  { id: 'pantry', label: 'Pantry', icon: 'cube-outline' },
];

const noop = () => {};

// PERFORMANCE: Screen-level error boundary prevents full app reset on mutation failures.
// DeferredScreen gates heavy work — skeleton paints instantly; PantryMainInner mounts
// on the deferred re-render.
export const PantryMain: React.FC = () => (
  <PantryErrorBoundary>
    <DeferredScreen
      fallback={
        <View style={styles.container} testID="pantry-screen">
          <TabScreenHeader label="Good morning" title="Pantry" />
          <View style={styles.searchContainer}>
            <SearchBar
              value=""
              onChangeText={noop}
              placeholder="Search your pantry..."
              showSearchIcon
              editable={false}
            />
          </View>
          <FilterTabs<LocationFilter>
            tabs={SKELETON_PANTRY_TABS}
            activeTabId="all"
            onTabChange={noop}
          />
          <SectionHeader
            title="ALL ITEMS"
            variant="default"
            actionLabel="Sort ↓"
            onActionPress={noop}
            testID="pantry-sort-button"
          />
          <PantryScreenSkeleton />
        </View>
      }
      component={PantryMainInner}
    />
  </PantryErrorBoundary>
);
const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    paddingTop: theme.spacing.sm,
    backgroundColor: theme.colors.background,
  },
  searchContainer: {
    paddingHorizontal: theme.spacing.md,
  },
}));
