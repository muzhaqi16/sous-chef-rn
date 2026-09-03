import React, { useEffect, useRef, useState } from 'react';
import { useUnreadNotificationCount } from '#features/notifications/hooks/useUnreadNotificationCount';
import {
  View,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { useTranslation } from '#/i18n';
import { useAnimatedReaction } from 'react-native-reanimated';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useTabBarAddButton } from '#hooks/navigation/useTabBarAddButton';
import { StyleSheet } from 'react-native-unistyles';
import { usePantrySelectorConfig } from '#features/pantry/hooks/usePantrySelectorConfig';
import { useScannerSetup } from '#features/barcode/hooks/useScannerSetup';
import { useSelectorManagement } from '#hooks/ui/useSelectorManagement';
import {
  useTabBarSetters,
  useTabBarState,
} from '#/context/TabBarActionsContext';
import { useCollapsibleScroll } from '#hooks/animations/useCollapsibleScroll';
import { SpotlightCoachMark } from '#/components/organisms/SpotlightCoachMark/SpotlightCoachMark';
import {
  useTutorialSequence,
  type TutorialStep,
} from '#hooks/ui/useTutorialSequence';
import { Telemetry } from '#services/telemetry';
import { useStore } from '#store';
import { usePantryScreen } from '#features/pantry/hooks/usePantryScreen';
import { useTabScreenLifecycle } from '#hooks/performance/useTabScreenLifecycle';
import {
  PantryModalsProvider,
  usePantryModals,
} from '#features/pantry/context/PantryModalsContext';
import { AnimatedItemSelector } from '#components/organisms/AnimatedItemSelector/AnimatedItemSelector';
import { PantryContent } from '#features/pantry/components/PantryContent';
import type { PantryContentRef } from '#features/pantry/components/pantryDisplay/types';
import type { ItemSelectorRef } from '#components/organisms/AnimatedItemSelector/types';
import type { LocationFilter } from '#features/pantry/utils/pantryFilters';
import { PantryErrorBoundary } from '#/components/providers/ScreenErrorBoundary';
import type { FilterTabConfig } from '#components/molecules/FilterTabs/types';
import { DeferredScreen } from '#components/performance/DeferredScreen';
import { PantryScreenSkeleton } from '#features/pantry/components/skeletons/PantryScreenSkeleton';
import { TabScreenHeader } from '#components/molecules/TabScreenHeader';
import { SearchBar } from '#components/molecules/SearchBar';
import { FilterTabs } from '#components/molecules/FilterTabs/FilterTabs';
import { TabMainScreen } from '#components/templates/TabMainScreen';
import { usePantryPermissions } from '#features/pantry/hooks/usePantryPermissions';
import type { Translate } from '#/i18n/types';

function buildPantryTutorialSteps(t: Translate): TutorialStep[] {
  return [
    {
      featureId: 'pantry_tutorial_home',
      title: t('pantryScreen.tutorialManageHomesTitle'),
      subtitle: t('pantryScreen.tutorialManageHomesSubtitle'),
      rectKey: 'homeBadge',
    },
    {
      featureId: 'pantry_tutorial_settings',
      title: t('labels.pantrySettings'),
      subtitle: t('pantryScreen.tutorialPantrySettingsSubtitle'),
      rectKey: 'settingsIcon',
    },
    {
      featureId: 'pantry_tutorial_add',
      title: t('pantryScreen.tutorialAddItemsTitle'),
      subtitle: t('pantryScreen.tutorialAddItemsSubtitle'),
      rectKey: 'addButton',
    },
  ];
}

/**
 * Runs every heavy hook; mounts only after DeferredScreen's deferred re-render,
 * so the skeleton paints instantly.
 */
const PantryMainInner: React.FC = () => {
  const {
    toProfile,
    toNotifications,
    toHomeManagement,
    toPantryAnalytics,
    toFilteredPantryItems,
    toPantrySettings,
    toPantryItem,
    toPantryItemDetail,
  } = useAppNavigation();
  const { setOverlayOpen, scrollTabBarHidden } = useTabBarSetters();

  // Deep link `pantry?homeId=` switches the active home. Tab-route params type
  // as `object` in RN's global param list, so read the query param directly.
  const route = useRoute();
  const deepLinkedHomeId = (route.params as { homeId?: string } | undefined)
    ?.homeId;
  useEffect(() => {
    if (deepLinkedHomeId) {
      useStore.getState().setSelectedHomeId(deepLinkedHomeId);
    }
  }, [deepLinkedHomeId]);

  const {
    scrollBeginDragHandler,
    scrollHandler,
    scrollEndDragHandler,
    momentumEndHandler,
    isScrolledDown,
    isUserDragging,
  } = useCollapsibleScroll();

  // Scroll direction → tab bar visibility, UI thread only.
  useAnimatedReaction(
    () => isScrolledDown.get(),
    hidden => {
      scrollTabBarHidden.set(hidden);
    },
  );

  const screen = usePantryScreen();

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

  const selectorRef = useRef<ItemSelectorRef>(null);
  const pantryContentRef = useRef<PantryContentRef>(null);

  const [isPantryFocused, setIsPantryFocused] = useState(true);
  const [onPantryFocus] = useState(() => () => {
    setIsPantryFocused(true);
    // A stale scroll-hidden state from a previous visit must not leave the bar
    // hidden.
    isScrolledDown.set(false);
    isUserDragging.set(false);
    scrollTabBarHidden.set(false);
    const store = useStore.getState();
    if (store.pendingPantryScrollToTop) {
      pantryContentRef.current?.scrollToTop();
      store.setPendingPantryScrollToTop(false);
    }
    return () => {
      setIsPantryFocused(false);
      // Reset the scroll-driven hide so the bar reappears on other tabs.
      isUserDragging.set(false);
      scrollTabBarHidden.set(false);
    };
  });
  useFocusEffect(onPantryFocus);

  const { handleOpenSelector, handleOverlayOpen, handleOverlayClose } =
    useSelectorManagement({ selectorRef, setOverlayOpen });

  useScannerSetup({
    enabled: true,
    homeId: screen.selectedHomeId,
    context: { source: 'pantry', pantryId: screen.pantry?.id },
  });

  const pantryConfig = usePantrySelectorConfig({
    pantries: screen.pantries,
    selectedPantryId: screen.pantry?.id,
    loading: screen.loading,
    setSelectedPantryId: screen.setSelectedPantryId,
    selectorRef,
    toPantrySettings,
    toPantryAnalytics,
  });

  const canStartTutorial = !!screen.selectedHomeId;

  const handleItemPress = (id: string) => toPantryItemDetail({ itemId: id });
  const handleAvatarPress = toProfile;
  const handleNotificationPress = toNotifications;
  const handleHomePress = () =>
    toHomeManagement({ selectedHomeId: screen.selectedHomeId ?? undefined });
  const handleAnalyticsPress = () => {
    if (screen.pantry?.id) {
      toPantryAnalytics({ pantryId: screen.pantry.id });
    }
  };
  const handleLowStockNavigate = () =>
    toFilteredPantryItems({ mode: 'lowStock' });
  const handleExpiringNavigate = () =>
    toFilteredPantryItems({ mode: 'expiring' });
  const handleExpiredNavigate = () =>
    toFilteredPantryItems({ mode: 'expired' });
  const handleSelectHome = () => toHomeManagement();
  const handleCreatePantry = () => toPantrySettings();
  const stableNavigateTo = {
    pantryItem: (params: { itemId: string }) => toPantryItem(params),
  };

  return (
    <PantryModalsProvider
      pantryId={screen.pantry?.id}
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
        onExpiringNavigate={handleExpiringNavigate}
        onExpiredNavigate={handleExpiredNavigate}
        onSelectHome={handleSelectHome}
        onCreatePantry={handleCreatePantry}
        onOverlayOpen={handleOverlayOpen}
        onOverlayClose={handleOverlayClose}
        canStartTutorial={canStartTutorial}
        isPantryFocused={isPantryFocused}
        scrollBeginDragHandler={scrollBeginDragHandler}
        scrollHandler={scrollHandler}
        scrollEndDragHandler={scrollEndDragHandler}
        momentumEndHandler={momentumEndHandler}
      />
    </PantryModalsProvider>
  );
};

/**
 * Split from PantryMainInner so `usePantryModals()` resolves — it has to run
 * inside the provider.
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
  onExpiringNavigate: () => void;
  onExpiredNavigate: () => void;
  onSelectHome: () => void;
  onCreatePantry: () => void;
  onOverlayOpen: () => void;
  onOverlayClose: () => void;
  canStartTutorial: boolean;
  isPantryFocused: boolean;
  scrollBeginDragHandler: () => void;
  scrollHandler: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEndDragHandler: (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => void;
  momentumEndHandler: () => void;
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
  onExpiringNavigate,
  onExpiredNavigate,
  onSelectHome,
  onCreatePantry,
  onOverlayOpen,
  onOverlayClose,
  canStartTutorial,
  isPantryFocused,
  scrollBeginDragHandler,
  scrollHandler,
  scrollEndDragHandler,
  momentumEndHandler,
}: PantryMainContentProps) {
  const unreadNotificationCount = useUnreadNotificationCount();
  const { t } = useTranslation();
  const {
    handleConsumeItem,
    handleWasteItem,
    handleRestockItem,
    handleEditItem,
    handleDeleteItem,
    setAddSheetVisible,
    setAddLocationSheetVisible,
  } = usePantryModals();

  const permissions = usePantryPermissions();

  // Element positions for the tutorial spotlight coach-marks.
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

  const tutorial = useTutorialSequence({
    steps: buildPantryTutorialSteps(t),
    targetRects: {
      homeBadge: homeBadgeRect,
      settingsIcon: settingsIconRect,
      addButton: addButtonRect,
    },
    canStart: canStartTutorial,
    isPaused: !isPantryFocused || isOverlayOpen,
  });

  const tutorialTargetActions: Record<number, () => void> = {
    0: onHomePress,
    1: onSettingsPress,
    2: () => {
      Telemetry.trackEvent('add_pantry_item_clicked');
      setAddSheetVisible(true);
    },
  };

  const canAdd =
    !screen.noHomeSelected &&
    !screen.noHomes &&
    !screen.noPantries &&
    permissions.canAddItems;

  // Always registered, gated by `disabled` rather than passed as `undefined`:
  // add-button visibility is per-tab (TabBarActionsContext's `shouldShowAdd`), so
  // an undefined handler leaves a live-looking button that silently does nothing.
  // `disabled` routes the press through FloatingTabBar's toast instead.
  useTabBarAddButton(() => {
    Telemetry.trackEvent('add_pantry_item_clicked');
    setAddSheetVisible(true);
  }, !canAdd);

  const handleAddItem = canAdd ? () => setAddSheetVisible(true) : undefined;

  const handleAddLocationPress = () => {
    setAddLocationSheetVisible(true);
  };

  return (
    <TabMainScreen testID="pantry-screen">
      <PantryContent
        ref={pantryContentRef}
        userName={screen.userName}
        householdName={screen.householdName}
        avatarUrl={screen.authUser?.profilePicture}
        notificationCount={unreadNotificationCount}
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
        onItemEdit={permissions.canEditItems ? handleEditItem : undefined}
        onItemDelete={permissions.canEditItems ? handleDeleteItem : undefined}
        onItemConsume={permissions.canEditItems ? handleConsumeItem : undefined}
        onItemWaste={permissions.canEditItems ? handleWasteItem : undefined}
        onItemRestock={permissions.canEditItems ? handleRestockItem : undefined}
        onAvatarPress={onAvatarPress}
        onNotificationPress={onNotificationPress}
        onHomePress={onHomePress}
        onSettingsPress={onSettingsPress}
        onAnalyticsPress={onAnalyticsPress}
        onLowStockNavigate={onLowStockNavigate}
        onExpiringNavigate={onExpiringNavigate}
        onExpiredNavigate={onExpiredNavigate}
        totalCount={screen.totalCount}
        noHomeSelected={screen.noHomeSelected}
        noHomes={screen.noHomes}
        noPantries={screen.noPantries}
        onSelectHome={onSelectHome}
        onCreatePantry={onCreatePantry}
        onAddItem={handleAddItem}
        onRefresh={screen.handleRefresh}
        onEndReached={
          screen.hasMore && screen.pantryItems.length > 0
            ? screen.loadMore
            : undefined
        }
        isLoadingMore={screen.searchActive ? false : screen.isLoadingMore}
        hasMore={screen.searchActive ? false : screen.hasMore}
        refreshing={screen.isRefreshing}
        loading={screen.isLoadingInitial}
        fetching={screen.itemsFetching}
        serverMode={screen.serverMode}
        onHomeBadgeLayout={setHomeBadgeRect}
        onSettingsIconLayout={setSettingsIconRect}
        scrollHandler={scrollHandler}
        onScrollBeginDrag={scrollBeginDragHandler}
        onScrollEndDrag={scrollEndDragHandler}
        onMomentumScrollEnd={momentumEndHandler}
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
          onNext={tutorial.advanceInPlace}
          onTargetPress={() => {
            const action =
              tutorialTargetActions[tutorial.currentStep!.stepIndex];
            action?.();
            tutorial.advance();
          }}
        />
      ) : null}
    </TabMainScreen>
  );
}

const noop = () => {};

const PantryMainFallback: React.FC = () => {
  const { t } = useTranslation();
  const skeletonTabs: FilterTabConfig<LocationFilter>[] = [
    { id: 'all', label: t('pantryScreen.tabAll') },
    {
      id: 'fridge',
      label: t('labels.storageRefrigerated'),
      icon: 'thermometer-outline',
    },
    {
      id: 'freezer',
      label: t('labels.storageFrozen'),
      icon: 'snow-outline',
    },
    {
      id: 'pantry',
      label: t('labels.storageAmbient'),
      icon: 'cube-outline',
    },
  ];
  return (
    <TabMainScreen testID="pantry-screen">
      <TabScreenHeader
        label={t('pantryScreen.greetingFallback')}
        title={t('pantryScreen.tabPantry')}
      />
      <View style={styles.searchContainer}>
        <SearchBar
          value=""
          onChangeText={noop}
          placeholder={t('pantryScreen.searchPlaceholder')}
          showSearchIcon
          editable={false}
        />
      </View>
      <FilterTabs<LocationFilter>
        tabs={skeletonTabs}
        activeTabId="all"
        onTabChange={noop}
      />
      <PantryScreenSkeleton />
    </TabMainScreen>
  );
};

// The screen-level boundary keeps a mutation failure from resetting the whole app.
export const PantryMain: React.FC = () => (
  <PantryErrorBoundary>
    <DeferredScreen
      fallback={<PantryMainFallback />}
      component={PantryMainInner}
    />
  </PantryErrorBoundary>
);
const styles = StyleSheet.create(theme => ({
  searchContainer: {
    paddingHorizontal: theme.spacing.base,
  },
}));
