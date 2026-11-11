import {
  deleteAction,
  editAction,
} from '#components/organisms/SwipeableItem/commonActions';
import React, { useEffect, useEffectEvent, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { useAnimatedReaction } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet } from 'react-native-unistyles';
import { useCollapsibleScroll } from '#hooks/animations/useCollapsibleScroll';

// Components
import { AnimatedItemSelector } from '#components/organisms/AnimatedItemSelector/AnimatedItemSelector';
import { ListTemplate } from '#features/shoppingList/components/ListTemplate';
import { SearchBar } from '#components/molecules/SearchBar';
import { ShoppingListTabs } from '#features/shoppingList/components/ShoppingListTabs/ShoppingListTabs';
import {
  SpotlightCoachMark,
  type TargetRect,
} from '#components/organisms/SpotlightCoachMark/SpotlightCoachMark';

// Hooks & Context
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useTabBarAddMenu } from '#hooks/navigation/useTabBarAddMenu';
import type { useShoppingListScreen } from '#features/shoppingList/screens/useShoppingListScreen';
import { useShoppingListActions } from '#features/shoppingList/hooks/useShoppingListActions';
import { useBatchMoveToPantry } from '#features/shoppingList/hooks/useBatchMoveToPantry';
import { useShoppingListSelectorModal } from '#features/shoppingList/components/useShoppingListSelectorModal';
import { useItemReordering } from '#features/shoppingList/hooks/useItemReordering';
import { useSwipeableCoordinator } from '#hooks/ui/useSwipeableCoordinator';
import {
  useTabBarSetters,
  useTabBarState,
} from '#/context/TabBarActionsContext';
import {
  useShoppingListModalActions,
  useAnyShoppingListSheetVisible,
} from '#features/shoppingList/context/ShoppingListModalsContext';
import { useUser } from '#store/useAppStore';
import { useFirstShopTourContext } from '#features/shoppingList/context/FirstShopTourContext';
import { useTutorialSequence } from '#hooks/ui/useTutorialSequence';
import { useNewFeatureTour } from '#hooks/ui/useNewFeatureTour';
import { FIRST_SHOP_STEP } from '#features/shoppingList/context/useFirstShopTour';

// Utils
import { useShoppingListPermissions } from '#features/shoppingList/hooks/useShoppingListPermissions';
import { useBudgetAndPricesEnabled } from '#hooks/settings/useBudgetAndPricesEnabled';
import { useStoreModeEnabled } from '#features/shoppingList/hooks/useStoreModeEnabled';
import { Telemetry } from '#/services/telemetry';
import { executeRefreshWithFinally } from '#/utils/finallyHelpers';
import { errorService } from '#/services/errorService';
import { DataStateView } from '#components/organisms/DataStateView';
import { ShoppingListPermissionsProvider } from '#features/shoppingList/context/ShoppingListPermissionsContext';
import { useDataState } from '#hooks/data/useDataState';
import { useOfflineAwareError } from '#hooks/app/useOfflineAwareError';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { Screen, type ScreenHeaderConfig } from '#components/templates/Screen';
import type { BarAction } from '#components/molecules/BarActions';
import { shoppingListTestIDs } from '#features/shoppingList/testIDs';

/** When store mode reached production (4.8.1). */
const STORE_MODE_RELEASED = '2026-10-20T00:00:00Z';
/**
 * Inner content component that uses modal context.
 * Separated to allow useShoppingListModals() to access the provider.
 */
export interface ShoppingListMainContentProps {
  screenData: ReturnType<typeof useShoppingListScreen>;
}

// Not wrapped in React.memo — the React Compiler memoizes this element at its
// parent call site (`ShoppingListMain`), so a manual memo boundary is redundant
// (and would be defeated anyway by `screenData` being a fresh object each render).
export const ShoppingListMainContent: React.FC<
  ShoppingListMainContentProps
> = ({ screenData }) => {
  const { t } = useTranslation();
  const {
    state: {
      lists,
      listDataWithOwnership,
      currentList,
      currentListDetails,
      currentListId,
      unpurchasedItems,
      purchasedItems,
      rawUnpurchasedItems,
      rawPurchasedItems,
      isLoadingInitial,
      loading,
      detailsLoading,
      listsLoading,
      listsError,
      listsHasResult,
      searchQuery,
      totalCountUnpurchased,
      totalCountPurchased,
      hasMoreUnpurchased,
      isLoadingMoreUnpurchased,
      hasMorePurchased,
      isLoadingMorePurchased,
      isTransitioning,
      error,
      showImages,
    },
    actions: {
      setSearchQuery,
      toggleItem,
      removeItem,
      refetch: refetchItems,
      loadMoreUnpurchased,
      loadMorePurchased,
      setSelectedShoppingListId,
    },
  } = screenData;

  const {
    openAddItemSheet,
    openAddItemManually,
    openQuantityEdit,
    openPurchaseAmount,
    openMoveToPantry,
  } = useShoppingListModalActions();
  const anySheetVisible = useAnyShoppingListSheetVisible();

  const {
    toBarcode,
    toReceiptScan,
    toListSettings,
    toShoppingListItemDetail,
    toEditItem,
    toStoreMode,
    toListBudget,
  } = useAppNavigation();
  const storeModeEnabled = useStoreModeEnabled();
  const storeModeTourAllowed = useNewFeatureTour({
    introducedOn: STORE_MODE_RELEASED,
    flag: 'storeMode',
  });
  const [storeModeRect, setStoreModeRect] = useState<TargetRect | null>(null);
  const budgetAndPricesEnabled = useBudgetAndPricesEnabled();
  const { setScannerProps, scrollTabBarHidden, setAddMenuOpen } =
    useTabBarSetters();
  const { isOverlayOpen } = useTabBarState();

  // ── Scroll direction tracking (tab bar hide on scroll down) ──
  const {
    scrollBeginDragHandler,
    scrollHandler,
    scrollEndDragHandler,
    momentumEndHandler,
    isScrolledDown,
    isUserDragging,
  } = useCollapsibleScroll();

  useAnimatedReaction(
    () => isScrolledDown.get(),
    hidden => {
      scrollTabBarHidden.set(hidden);
    },
  );

  const tour = useFirstShopTourContext();

  // ── Screen focus tracking ──
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const [onScreenFocus] = useState(() => () => {
    setIsScreenFocused(true);
    // Return to a clean, visible tab bar on focus so a stale scroll-hidden
    // state from a previous visit can never leave the bar hidden.
    isScrolledDown.set(false);
    isUserDragging.set(false);
    scrollTabBarHidden.set(false);
    return () => {
      setIsScreenFocused(false);
      isUserDragging.set(false);
      scrollTabBarHidden.set(false);
    };
  });
  useFocusEffect(onScreenFocus);

  // Get current user for permission calculations
  const user = useUser();

  // --- Actions Hook ---
  const {
    handleTogglePurchase,
    handleDeleteItem,
    handleClearAllPurchased,
    handleClearAllShopping,
  } = useShoppingListActions({
    currentListId,
    unpurchasedItems: rawUnpurchasedItems,
    purchasedItems: rawPurchasedItems,
    toggleItem,
    removeItem,
  });

  // A tap toggles purchased with default values, no sheet; a long-press
  // (`withDetails`) on an unpurchased item opens the pre-filled amount sheet,
  // where Cancel leaves it unpurchased, and is a no-op otherwise.
  const handleTogglePurchaseAction = (
    itemId: string,
    opts?: { withDetails?: boolean },
  ) => {
    if (opts?.withDetails) {
      const isUnpurchased = rawUnpurchasedItems.some(
        item => item.id === itemId,
      );
      if (isUnpurchased) openPurchaseAmount(itemId);
      return;
    }
    void handleTogglePurchase(itemId);
  };

  // --- Batch Move to Pantry Hook ---
  const { batchMoveToPantry, loading: batchMoveToPantryLoading } =
    useBatchMoveToPantry({ currentListId, purchasedItems: rawPurchasedItems });

  // --- Reordering Hook ---
  const { handleSortOrderUpdate: reorderItem } = useItemReordering({
    listId: currentListId,
    items: rawUnpurchasedItems,
    refetch: () => {
      void refetchItems().catch(error =>
        errorService.reportError(error, {
          operation: 'ShoppingListMainContent.reorderRefetch',
        }),
      );
    },
  });

  const handleSortOrderUpdate = (
    itemId: string,
    afterItemId: string | null,
    beforeItemId: string | null,
  ) => {
    void reorderItem(itemId, afterItemId, beforeItemId);
  };

  // --- Selector Hook ---
  const {
    selectorRef,
    listConfig,
    handleOpenSelector,
    handleOverlayOpen,
    handleOverlayClose,
  } = useShoppingListSelectorModal({
    listDataWithOwnership,
    currentListId,
    setSelectedShoppingListId,
  });

  // Local state
  const [refreshing, setRefreshing] = useState(false);

  // Coordinate swipeable items so only one is open at a time
  const { handleSwipeableWillOpen, handleSwipeableClose, closeAll } =
    useSwipeableCoordinator();

  // A tip that points into a row needs the row closed: one left swiped open
  // puts its checkbox and icons beside where they rest.
  const rowStep = !!tour?.wanted.checkbox || !!tour?.wanted.archiveIcon;
  const closeRows = useEffectEvent(closeAll);
  useEffect(() => {
    if (rowStep) closeRows();
  }, [rowStep]);

  // Handle refresh
  const handleRefresh = () => {
    return executeRefreshWithFinally(() => refetchItems(), setRefreshing);
  };

  // Classified on the LIST query, not the items query: with no lists there is
  // no list to have items for, so the question is only whether the list fetch
  // succeeded, failed, or was never attempted.
  const listsState = useDataState({
    loading: listsLoading,
    error: listsError,
    hasResult: listsHasResult,
    isEmpty: lists.length === 0,
  });

  // A failed item read with nothing cached is not an empty list, and saying so
  // invites re-adding what is already on it.
  const itemsFailure = useOfflineAwareError(
    error,
    rawUnpurchasedItems.length > 0 || rawPurchasedItems.length > 0,
  );

  const permissions = useShoppingListPermissions(currentListDetails, user?.id);
  const networkWithheld = useIsApiUnavailable();

  // One declaration of this screen's tab header. The no-lists branch has no list
  // to name, so it shows the generic one.
  const tabHeader: ScreenHeaderConfig = {
    variant: 'tab',
    title: t('labels.shoppingList'),
  };
  // Opt-in from Settings: the list walked aisle by aisle on its own screen.
  const storeModeAction: BarAction | null =
    storeModeEnabled && currentListId
      ? {
          icon: 'storefront-outline',
          tone: 'textSecondary',
          onPress: () => toStoreMode({ listId: currentListId }),
          testID: shoppingListTestIDs.storeModeButton,
          accessibilityLabel: t('shoppingListScreens.storeMode.open'),
          onMeasure: rect => setStoreModeRect({ ...rect, shape: 'round' }),
        }
      : null;
  // Store mode reached production in 4.8.1: an account older than that is
  // shown where it opens, once.
  const storeModeTour = useTutorialSequence({
    tourId: 'feature_store_mode',
    steps: [
      {
        featureId: 'feature_store_mode',
        title: t('settings.storeMode'),
        subtitle: t('shoppingListTutorial.storeModeNew.subtitle'),
        rectKey: 'storeMode',
        when: () => storeModeTourAllowed && storeModeAction !== null,
      },
    ],
    targetRects: { storeMode: storeModeRect },
    canStart: !!currentListId,
    isPaused: !isScreenFocused || isOverlayOpen || anySheetVisible,
  });
  // Opt-in from Settings: the list's money on a screen of its own.
  const budgetAction: BarAction | null =
    budgetAndPricesEnabled && currentListId
      ? {
          icon: 'wallet-outline',
          tone: 'textSecondary',
          onPress: () => toListBudget({ listId: currentListId }),
          testID: shoppingListTestIDs.budgetAndPricesButton,
          accessibilityLabel: t('labels.budgetAndPrices'),
        }
      : null;
  const headerActions: BarAction[] = [budgetAction, storeModeAction].flatMap(
    action => (action ? [action] : []),
  );
  const selectedListHeader: ScreenHeaderConfig = {
    ...tabHeader,
    title: currentList?.name ?? tabHeader.title,
    switchable: {
      onPress: handleOpenSelector,
      accessibilityHint: t('shoppingListScreen.switchListAccessibility'),
      testID: shoppingListTestIDs.listSelectorButton,
    },
    actions: headerActions.length > 0 ? headerActions : undefined,
  };

  // SearchBar rendered above tab pills (positioned above TabView in ShoppingListTabs)
  const searchBarHeader = (
    <View style={styles.searchBarContainer}>
      <SearchBar
        testID={shoppingListTestIDs.searchInput}
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder={t('shoppingListScreen.searchPlaceholder')}
      />
    </View>
  );

  const customListProps = {
    // Actions
    onTogglePurchase: handleTogglePurchaseAction,
    onMoveToPantry: openMoveToPantry,
    onQuantityPress: openQuantityEdit,
    onSortOrderUpdate: handleSortOrderUpdate,
    // `onRefresh` is NOT here: the template injects it from its own prop.
    onClearAllPurchased: handleClearAllPurchased,
    onClearAllShopping: handleClearAllShopping,
    onSwipeableWillOpen: handleSwipeableWillOpen,
    onSwipeableClose: handleSwipeableClose,
    onCloseAllSwipeables: closeAll,
    // Only offer "Move All to Pantry" when the list is linked to a home — the
    // server rejects the batch move otherwise (no home means no target pantry).
    onBatchMoveToPantry: currentListDetails?.canMoveToPantry
      ? batchMoveToPantry
      : undefined,
    // State
    loading: isLoadingInitial,
    refreshing,
    disabled: !!searchQuery.trim(),
    isTransitioning,
    batchMoveToPantryLoading,
    // Data
    unpurchasedItems,
    purchasedItems,
    showImages,
    totalCountUnpurchased,
    totalCountPurchased,
    // Pagination
    onEndReachedUnpurchased: loadMoreUnpurchased,
    hasMoreUnpurchased,
    isLoadingMoreUnpurchased,
    onEndReachedPurchased: loadMorePurchased,
    hasMorePurchased,
    isLoadingMorePurchased,
    // Permissions come from `ShoppingListPermissionsProvider`, not here: through
    // `Record<string, unknown>` they would arrive as `boolean | undefined`.
    searchQuery,
    // Scroll direction tracking — threaded to FlashList via data context
    onScroll: scrollHandler,
    onScrollBeginDrag: scrollBeginDragHandler,
    onScrollEndDrag: scrollEndDragHandler,
    onMomentumScrollEnd: momentumEndHandler,
    scrollEventThrottle: 16,
  };

  // Set up scanner button
  useEffect(() => {
    const handleScanPress = () => {
      Telemetry.trackEvent('barcode_scanner_opened', {
        source: 'shopping_list',
        list_id: currentListId,
      });
      toBarcode({
        source: 'shoppingList',
        shoppingListId: currentListId,
      });
    };

    setScannerProps(handleScanPress, true);

    return () => {
      setScannerProps(undefined, false);
    };
  }, [setScannerProps, toBarcode, currentListId]);

  // Only a KNOWN refusal says there is no permission: while the answer is
  // unresolved that is a claim the app cannot make yet, even to the list's owner.
  const addRefusal = permissions.resolved
    ? t('shoppingListScreen.noAddPermission')
    : t('labels.loading');
  // Every way to add is one tap from here, as on Recipes.
  const addDisabledReason = permissions.canAddItems ? undefined : addRefusal;
  // An add handed over from Today waits for this, not for the refusal.
  const addPending = !permissions.resolved;
  // With no list to add to, the + makes one, as the empty state offers: its
  // permissions never resolve, so the entries would wait on "Loading" forever.
  const noLists = !isLoadingInitial && listsState === 'empty';
  useTabBarAddMenu(
    noLists
      ? [
          {
            key: 'createList',
            label: t('shoppingListScreen.noListsAction'),
            icon: 'cart-outline',
            onPress: () => toListSettings(),
          },
        ]
      : [
          {
            key: 'search',
            label: t('labels.searchToAdd'),
            icon: 'search',
            onPress: () => {
              Telemetry.trackEvent('add_item_from_tab_bar', {
                list_id: currentListId,
              });
              openAddItemSheet();
            },
            disabledReason: addDisabledReason,
            pending: addPending,
          },
          {
            key: 'barcode',
            label: t('labels.scanBarcode'),
            icon: 'barcode-outline',
            onPress: () =>
              toBarcode({
                source: 'shoppingList',
                shoppingListId: currentListId,
              }),
            disabledReason: addDisabledReason,
            pending: addPending,
          },
          {
            key: 'manual',
            label: t('labels.addManually'),
            icon: 'create-outline',
            onPress: openAddItemManually,
            disabledReason: addDisabledReason,
            pending: addPending,
          },
        ],
  );

  // Every screen whose header carries the switch-list button mounts this.
  const listSelector = (
    <AnimatedItemSelector
      ref={selectorRef}
      config={listConfig}
      onOpen={handleOverlayOpen}
      onClose={handleOverlayClose}
    />
  );

  // No lists on screen. Only a fetch that actually succeeded and returned
  // nothing may offer to create one — after a failure we do not know whether
  // this person already has lists, and "Create a list" would duplicate them.
  // The remembered list's lines can land first: they stay up meanwhile.
  if (!isLoadingInitial && listsState !== 'loading' && lists.length === 0) {
    return (
      <Screen
        testID={shoppingListTestIDs.screen}
        header={tabHeader}
        scroll="list"
        gutter="none"
      >
        <DataStateView
          state={listsState}
          onRetry={handleRefresh}
          empty={{
            icon: 'cart-outline',
            title: t('shoppingListScreen.noListsTitle'),
            description: t('shoppingListScreen.noListsDescription'),
            action: {
              label: t('shoppingListScreen.noListsAction'),
              onPress: () => toListSettings(),
            },
          }}
        />
      </Screen>
    );
  }

  // With permissions unknown (the detail request failed, or was never cached)
  // this offers a retry: read-only would claim a refusal never sent. Gated on the
  // DETAIL query's loading; the item flags settle first and would flash this.
  if (
    !detailsLoading &&
    !isLoadingInitial &&
    !loading &&
    !permissions.resolved
  ) {
    return (
      <Screen
        testID={shoppingListTestIDs.screen}
        header={selectedListHeader}
        scroll="list"
        gutter="none"
      >
        <DataStateView
          state={networkWithheld ? 'offline' : 'error'}
          onRetry={handleRefresh}
        />
        {listSelector}
      </Screen>
    );
  }

  if (
    !isLoadingInitial &&
    rawUnpurchasedItems.length === 0 &&
    rawPurchasedItems.length === 0 &&
    (itemsFailure.offline || itemsFailure.error)
  ) {
    return (
      <Screen
        testID={shoppingListTestIDs.screen}
        header={selectedListHeader}
        scroll="list"
        gutter="none"
      >
        <DataStateView
          state={itemsFailure.offline ? 'offline' : 'error'}
          onRetry={handleRefresh}
        />
        {listSelector}
      </Screen>
    );
  }

  const emptyStateConfig = {
    icon: 'cart-outline',
    title: t('shoppingListScreen.emptyTitle'),
    description: t('shoppingListScreen.emptyDescription'),
    // The floating +'s menu, which also says why a member may not add.
    action: {
      label: t('labels.addItem'),
      icon: 'add',
      onPress: () => setAddMenuOpen(true),
    },
  };

  return (
    <Screen
      testID={shoppingListTestIDs.screen}
      header={selectedListHeader}
      scroll="list"
      gutter="none"
    >
      {searchBarHeader}
      <ShoppingListPermissionsProvider permissions={permissions}>
        <ListTemplate
          items={[]}
          loading={isLoadingInitial}
          onItemPress={id => {
            if (currentListId) {
              toShoppingListItemDetail({ listId: currentListId, itemId: id });
            }
          }}
          itemSwipeActions={id => ({
            left: [
              editAction(() => {
                if (currentListId) {
                  toEditItem({ listId: currentListId, itemId: id });
                }
              }),
            ],
            right: [
              {
                ...deleteAction(() => {
                  void handleDeleteItem(id);
                }),
                removesRow: true,
              },
            ],
          })}
          onRefresh={handleRefresh}
          emptyState={emptyStateConfig}
          customListComponent={ShoppingListTabs}
          customListProps={{
            ...customListProps,
          }}
        />
      </ShoppingListPermissionsProvider>

      {listSelector}

      {/* The first-shop guide and the swipe tip. Any open sheet hides them,
          including the ones they open; each resumes once the sheets close. */}
      {(() => {
        if (!tour || !isScreenFocused || isOverlayOpen || anySheetVisible)
          return null;
        const { guide, swipeTip } = tour;
        const guideStep = guide.currentStep;
        if (guideStep) {
          const featureId = guideStep.featureId;
          const firstUnpurchased = rawUnpurchasedItems[0]?.id;
          const firstToPutAway = rawPurchasedItems[0]?.id;
          const openSheet = () => {
            Telemetry.trackEvent('add_item_from_tab_bar', {
              list_id: currentListId,
              source: 'tutorial',
            });
            openAddItemSheet();
          };
          const onTargetPress = () => {
            if (featureId === FIRST_SHOP_STEP.add) {
              openSheet();
              guide.advanceInPlace();
            } else if (featureId === FIRST_SHOP_STEP.check) {
              if (firstUnpurchased) void handleTogglePurchase(firstUnpurchased);
              guide.advance();
            } else if (featureId === FIRST_SHOP_STEP.putAway) {
              // The move's write continues the guide, however it is moved.
              if (firstToPutAway) openMoveToPantry(firstToPutAway);
            }
          };
          return (
            <SpotlightCoachMark
              targetRect={guideStep.targetRect}
              title={guideStep.title}
              subtitle={guideStep.subtitle}
              stepIndex={guideStep.stepIndex}
              totalSteps={guideStep.totalSteps}
              waitsForAction={guideStep.waitsForAction}
              onDismiss={guide.skipAll}
              onClose={guide.pause}
              onNext={
                featureId === FIRST_SHOP_STEP.add
                  ? onTargetPress
                  : guide.advanceInPlace
              }
              onTargetPress={onTargetPress}
            />
          );
        }
        const tipStep = swipeTip.currentStep;
        const receiptStep = tour.receiptTip.currentStep;
        const featureStep = storeModeTour.currentStep;
        if (!tipStep && !receiptStep && featureStep) {
          return (
            <SpotlightCoachMark
              targetRect={featureStep.targetRect}
              title={featureStep.title}
              subtitle={featureStep.subtitle}
              onDismiss={storeModeTour.skipAll}
              onClose={storeModeTour.pause}
              onTargetPress={() => {
                if (currentListId) toStoreMode({ listId: currentListId });
                storeModeTour.advance();
              }}
            />
          );
        }
        if (!tipStep && receiptStep) {
          const { receiptTip } = tour;
          return (
            <SpotlightCoachMark
              targetRect={receiptStep.targetRect}
              title={receiptStep.title}
              subtitle={receiptStep.subtitle}
              onDismiss={receiptTip.skipAll}
              onClose={receiptTip.pause}
              onTargetPress={() => {
                toReceiptScan();
                receiptTip.advance();
              }}
            />
          );
        }
        if (!tipStep) return null;
        return (
          <SpotlightCoachMark
            targetRect={tipStep.targetRect}
            title={tipStep.title}
            subtitle={tipStep.subtitle}
            demo={tipStep.demo}
            onDismiss={swipeTip.skipAll}
            onClose={swipeTip.pause}
            allowGesturePassthrough
          />
        );
      })()}

      {/* Modals are rendered inside ShoppingListModalsProvider */}
    </Screen>
  );
};

const styles = StyleSheet.create(theme => ({
  searchBarContainer: {
    paddingHorizontal: theme.layout.pageGutter,
  },
}));
