import { pantryTestIDs } from '#features/pantry/testIDs';
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { useTranslation } from '#/i18n';
import { useAnimatedReaction } from 'react-native-reanimated';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useTabBarAddMenu } from '#hooks/navigation/useTabBarAddMenu';
import { StyleSheet } from 'react-native-unistyles';
import { usePantrySelectorConfig } from '#features/pantry/screens/usePantrySelectorConfig';
import { useScannerSetup } from '#features/barcode/screens/useScannerSetup';
import { useSelectorManagement } from '#hooks/ui/useSelectorManagement';
import {
  useTabBarSetters,
  useTabBarState,
} from '#/context/TabBarActionsContext';
import { useCollapsibleScroll } from '#hooks/animations/useCollapsibleScroll';
import { SpotlightCoachMark } from '#components/organisms/SpotlightCoachMark/SpotlightCoachMark';
import {
  useTutorialSequence,
  type TutorialStep,
} from '#hooks/ui/useTutorialSequence';
import { Telemetry } from '#services/telemetry';
import { useStore } from '#store';
import { usePantryScreen } from '#features/pantry/screens/usePantryScreen';
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
import { PantryErrorBoundary } from '#components/providers/ScreenErrorBoundary';
import type { FilterTabConfig } from '#components/organisms/FilterTabs/types';
import { DeferredScreen } from '#components/performance/DeferredScreen';
import { PantryScreenSkeleton } from '#features/pantry/components/skeletons/PantryScreenSkeleton';
import { SearchBar } from '#components/molecules/SearchBar';
import { FilterTabs } from '#components/organisms/FilterTabs/FilterTabs';
import { usePantryPermissions } from '#features/pantry/hooks/usePantryPermissions';
import type { Translate } from '#/i18n/types';
import { Screen } from '#components/templates/Screen';
import { TabScreenHeader } from '#components/molecules/TabScreenHeader';
import { useCurrentPantry } from '#features/pantry/hooks/useCurrentPantry';

function buildPantryTutorialSteps(t: Translate): TutorialStep[] {
  return [
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
    toHomeManagement,
    toPantryAnalytics,
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
    optimisticTypes: ['PantryItem', 'PantryItemBatch'],
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
        onSettingsPress={handleOpenSelector}
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
  onSettingsPress: () => void;
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
  onSettingsPress,
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
  const { t } = useTranslation();
  const { toBarcode, toReceiptScan } = useAppNavigation();
  const {
    handleConsumeItem,
    handleWasteItem,
    handleRestockItem,
    handleEditItem,
    handleDeleteItem,
    openAddSheet,
    openAddManually,
    setAddLocationSheetVisible,
  } = usePantryModals();

  const permissions = usePantryPermissions();

  // Element positions for the tutorial spotlight coach-marks.
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
      settingsIcon: settingsIconRect,
      addButton: addButtonRect,
    },
    canStart: canStartTutorial,
    isPaused: !isPantryFocused || isOverlayOpen,
  });

  const tutorialTargetActions: Record<number, () => void> = {
    0: onSettingsPress,
    1: () => {
      Telemetry.trackEvent('add_pantry_item_clicked');
      openAddSheet();
    },
  };

  const canAdd =
    !screen.noHomeSelected &&
    !screen.noHomes &&
    !screen.noPantries &&
    permissions.canAddItems;

  // Always registered, so the `+` says why it cannot add rather than doing
  // nothing. Every way to add is one tap from here, as on Recipes.
  const addRefusal = canAdd ? undefined : t('errors.codes.forbidden');
  useTabBarAddMenu([
    {
      key: 'search',
      label: t('labels.searchToAdd'),
      icon: 'search',
      onPress: () => {
        Telemetry.trackEvent('add_pantry_item_clicked');
        openAddSheet();
      },
      disabledReason: addRefusal,
    },
    {
      key: 'barcode',
      label: t('labels.scanBarcode'),
      icon: 'barcode-outline',
      onPress: () =>
        toBarcode({ source: 'pantry', pantryId: screen.pantry?.id }),
      disabledReason: addRefusal,
    },
    {
      key: 'receipt',
      label: t('labels.scanReceipt'),
      icon: 'receipt-outline',
      onPress: () => toReceiptScan(),
      disabledReason: addRefusal,
    },
    {
      key: 'manual',
      label: t('labels.addManually'),
      icon: 'create-outline',
      onPress: openAddManually,
      disabledReason: addRefusal,
    },
  ]);

  const handleAddItem = canAdd ? openAddSheet : undefined;

  const handleAddLocationPress = () => {
    setAddLocationSheetVisible(true);
  };

  const coachStep = tutorial.currentStep;

  return (
    <Screen testID={pantryTestIDs.screen} scroll="list" gutter="none">
      <PantryContent
        ref={pantryContentRef}
        pantryName={screen.pantry?.name ?? t('labels.pantry')}
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
        onItemDelete={permissions.canRemoveItems ? handleDeleteItem : undefined}
        onItemConsume={permissions.canEditItems ? handleConsumeItem : undefined}
        onItemWaste={permissions.canEditItems ? handleWasteItem : undefined}
        onItemRestock={permissions.canEditItems ? handleRestockItem : undefined}
        onSettingsPress={onSettingsPress}
        totalCount={screen.totalCount}
        noHomeSelected={screen.noHomeSelected}
        noHomes={screen.noHomes}
        noPantries={screen.noPantries}
        pantriesHidden={screen.pantriesHidden}
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
        itemsFailure={screen.itemsFailure}
        fetching={screen.itemsFetching}
        searching={screen.isSearching}
        serverMode={screen.serverMode}
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
      {coachStep ? (
        <SpotlightCoachMark
          targetRect={coachStep.targetRect}
          title={coachStep.title}
          subtitle={coachStep.subtitle}
          stepIndex={coachStep.stepIndex}
          totalSteps={coachStep.totalSteps}
          onDismiss={tutorial.skipAll}
          onNext={tutorial.advanceInPlace}
          onTargetPress={() => {
            const action = tutorialTargetActions[coachStep.stepIndex];
            action?.();
            tutorial.advance();
          }}
        />
      ) : null}
    </Screen>
  );
}

const noop = () => {};

const PantryMainFallback: React.FC = () => {
  const { t } = useTranslation();
  const { pantry } = useCurrentPantry();
  const skeletonTabs: FilterTabConfig<LocationFilter>[] = [
    { id: 'all', label: t('pantryScreen.tabAll') },
    {
      id: 'fridge',
      label: t('storageState.REFRIGERATED'),
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
    // No `header`: the loaded screen draws its own above its list, so the
    // chrome here is the same shape, with the same title, before it mounts.
    <Screen testID={pantryTestIDs.screen} scroll="list" gutter="none">
      <View style={styles.fallbackHeader}>
        <TabScreenHeader
          title={pantry?.name ?? t('labels.pantry')}
          switchable={{ onPress: noop }}
        />
      </View>
      <View style={styles.gutter}>
        <SearchBar
          value=""
          onChangeText={noop}
          placeholder={t('pantryScreen.searchPlaceholder')}
          editable={false}
        />
      </View>
      <View style={styles.gutter}>
        <FilterTabs<LocationFilter>
          tabs={skeletonTabs}
          activeTabId="all"
          onTabChange={noop}
        />
      </View>
      <View style={styles.gutter}>
        <PantryScreenSkeleton />
      </View>
    </Screen>
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
  // This screen renders its children bare under `gutter="none"`, so it supplies
  // the page gutter they do not carry themselves.
  gutter: {
    paddingHorizontal: theme.layout.pageGutter,
  },
  // The same lead-in and inset `PantryContent` gives the real header.
  fallbackHeader: {
    paddingHorizontal: theme.layout.pageGutter,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
  },
}));
