import {
  deleteAction,
  editAction,
} from '#components/organisms/SwipeableItem/commonActions';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { Pressable } from '#components/atoms/themedComponents';
import { useAnimatedReaction } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet } from 'react-native-unistyles';
import { useCollapsibleScroll } from '#hooks/animations/useCollapsibleScroll';

// Components
import { AnimatedItemSelector } from '#components/organisms/AnimatedItemSelector/AnimatedItemSelector';
import { ListTemplate } from '#features/shoppingList/components/ListTemplate';
import { SearchBar } from '#components/molecules/SearchBar';
import { ShoppingListTabs } from '#features/shoppingList/components/ShoppingListTabs/ShoppingListTabs';
import { SpotlightCoachMark } from '#components/organisms/SpotlightCoachMark/SpotlightCoachMark';
import { Icon } from '#utils/iconUtils';

// Hooks & Context
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useTabBarAddButton } from '#hooks/navigation/useTabBarAddButton';
import type { useShoppingListScreen } from '#features/shoppingList/hooks/useShoppingListScreen';
import { useShoppingListActions } from '#features/shoppingList/hooks/useShoppingListActions';
import { useBatchMoveToPantry } from '#features/shoppingList/hooks/useBatchMoveToPantry';
import { useShoppingListSelectorModal } from '#features/shoppingList/hooks/useShoppingListSelectorModal';
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
import {
  useShoppingListTutorial,
  ShoppingListTutorialStep,
  TUTORIAL_STEP_CONFIG,
  TUTORIAL_TOTAL_STEPS,
} from '#features/shoppingList/context/ShoppingListTutorialContext';

// Utils
import { useShoppingListPermissions } from '#features/shoppingList/hooks/useShoppingListPermissions';
import { discardOptimisticShoppingItems } from '#features/shoppingList/utils/optimisticItemCache';
import { Telemetry } from '#/services/telemetry';
import { executeRefreshWithFinally } from '#/utils/finallyHelpers';
import { DataStateView } from '#components/organisms/DataStateView';
import { useDataState } from '#hooks/data/useDataState';
import { Screen } from '#components/templates/Screen';

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
      showImages,
    },
    actions: {
      setSearchQuery,
      addItem,
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
    openQuantityEdit,
    openPurchaseAmount,
    openMoveToPantry,
  } = useShoppingListModalActions();
  const anySheetVisible = useAnyShoppingListSheetVisible();

  const { toBarcode, toListSettings, toShoppingListItemDetail, toEditItem } =
    useAppNavigation();
  const { setScannerProps, scrollTabBarHidden } = useTabBarSetters();
  const { addButtonRect, isOverlayOpen } = useTabBarState();

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

  // ── Interactive tutorial context ──
  const tutorial = useShoppingListTutorial();

  // Register the tab bar add button rect with the tutorial context
  useEffect(() => {
    tutorial?.registerRect('addButton', addButtonRect ?? null);
  }, [tutorial, addButtonRect]);

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
    addItem,
    toggleItem,
    removeItem,
    refetchItems,
    setSearchQuery,
  });

  // A plain checkbox tap marks the item purchased with default values (or
  // un-purchases) — no sheet. A long-press ({ withDetails: true }) opens the
  // pre-filled purchase-amount sheet so the user can record the actual
  // qty/price (Confirm records them; Cancel leaves it unpurchased). The sheet
  // only applies to unpurchased items; long-press is a no-op otherwise.
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
    handleTogglePurchase(itemId);
  };

  // --- Batch Move to Pantry Hook ---
  const { batchMoveToPantry, loading: batchMoveToPantryLoading } =
    useBatchMoveToPantry({ currentListId, purchasedItems: rawPurchasedItems });

  // --- Reordering Hook ---
  const { handleSortOrderUpdate: reorderItem } = useItemReordering({
    listId: currentListId,
    items: rawUnpurchasedItems,
    refetch: refetchItems,
  });

  const handleSortOrderUpdate = (
    itemId: string,
    afterItemId: string | null,
    beforeItemId: string | null,
  ) => {
    reorderItem(itemId, afterItemId, beforeItemId);
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

  // Handle refresh
  const handleRefresh = () => {
    discardOptimisticShoppingItems();
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

  const permissions = useShoppingListPermissions(currentListDetails, user?.id);

  // Header right action - list selector button
  const headerRight = (
    <Pressable
      onPress={handleOpenSelector}
      hitSlop={8}
      testID="shopping-list-selector"
      accessibilityRole="button"
      accessibilityLabel={t('shoppingListScreen.switchListAccessibility')}
    >
      <Icon name="list" size={24} tone="textSecondary" />
    </Pressable>
  );

  // SearchBar rendered above tab pills (positioned above TabView in ShoppingListTabs)
  const searchBarHeader = (
    <View style={styles.searchBarContainer}>
      <SearchBar
        testID="shopping-list-search-input"
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder={t('shoppingListScreen.searchPlaceholder')}
        showSearchIcon
      />
    </View>
  );

  const customListProps = {
    // Actions
    onTogglePurchase: handleTogglePurchaseAction,
    onMoveToPantry: openMoveToPantry,
    onQuantityPress: openQuantityEdit,
    onSortOrderUpdate: handleSortOrderUpdate,
    // `onRefresh` is NOT here: the template injects it from its own prop, which
    // this screen already sets to the same handler. Passing it twice collided
    // with the template's wiring — harmless while the values matched, and the
    // kind of thing the type now refuses outright.
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
    // Permissions
    canAddItems: permissions.canAddItems,
    canRemoveItems: permissions.canRemoveItems,
    canEditItems: permissions.canEditItems,
    canMarkPurchased: permissions.canMarkPurchased,
    canReorderItems: permissions.canEditItems,
    // Search query for search-aware empty states
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

  // Register add button action
  // Button visibility is automatic on allowed tabs; we just register handler and disabled state
  useTabBarAddButton(
    () => {
      Telemetry.trackEvent('add_item_from_tab_bar', {
        list_id: currentListId,
      });
      openAddItemSheet();
    },
    !permissions.canAddItems,
    permissions.canAddItems
      ? undefined
      : t('shoppingListScreen.noAddPermission'),
  );

  // No lists on screen. Only a fetch that actually succeeded and returned
  // nothing may offer to create one — after a failure we do not know whether
  // this person already has lists, and "Create a list" would duplicate them.
  if (!isLoadingInitial && lists.length === 0) {
    return (
      <Screen
        testID="shopping-list-screen"
        header={{
          variant: 'tab',
          label: t('shoppingListScreen.label'),
          title: t('labels.shoppingList'),
        }}
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

  const emptyStateConfig = {
    icon: 'cart-outline',
    title: t('shoppingListScreen.emptyTitle'),
    description: t('shoppingListScreen.emptyDescription'),
    action: {
      label: t('labels.addItem'),
      onPress: openAddItemSheet,
    },
  };

  return (
    <Screen
      testID="shopping-list-screen"
      header={{
        variant: 'tab',
        label: t('shoppingListScreen.label'),
        title: currentList?.name || t('labels.shoppingList'),
        headerRight: headerRight,
      }}
      scroll="list"
      gutter="none"
    >
      {searchBarHeader}
      <ListTemplate
        items={[]}
        loading={isLoadingInitial}
        onItemPress={id =>
          toShoppingListItemDetail({ listId: currentListId, itemId: id })
        }
        itemSwipeActions={id => ({
          left: [
            editAction(() => toEditItem({ listId: currentListId, itemId: id })),
          ],
          right: [
            { ...deleteAction(() => handleDeleteItem(id)), removesRow: true },
          ],
        })}
        onRefresh={handleRefresh}
        testIDPrefix="shopping-list-item"
        emptyState={emptyStateConfig}
        customListComponent={ShoppingListTabs}
        customListProps={{
          ...customListProps,
        }}
      />

      <AnimatedItemSelector
        ref={selectorRef}
        config={listConfig}
        onOpen={handleOverlayOpen}
        onClose={handleOverlayClose}
      />

      {/* Interactive tutorial spotlight coach-marks */}
      {(() => {
        if (!tutorial?.isActive) return null;
        if (!isScreenFocused || isOverlayOpen) return null;

        // Hide the spotlight whenever any modal sheet on this screen is
        // open — most importantly the purchase-amount sheet the long-press
        // step itself opens (it stays on SPOTLIGHT_LONG_PRESS_PRICE until
        // that sheet closes, see ShoppingListModalsContext), but this also
        // covers the user accidentally opening an unrelated sheet (e.g. Add
        // Item) mid-tutorial. The spotlight resumes once every sheet closes.
        if (anySheetVisible) return null;

        const isSwipeStep =
          tutorial.currentStep ===
          ShoppingListTutorialStep.SPOTLIGHT_SWIPE_ACTIONS;
        const isCheckboxStep =
          tutorial.currentStep === ShoppingListTutorialStep.SPOTLIGHT_CHECKBOX;
        const isLongPressStep =
          tutorial.currentStep ===
          ShoppingListTutorialStep.SPOTLIGHT_LONG_PRESS_PRICE;
        const isMoveToPantryStep =
          tutorial.currentStep ===
          ShoppingListTutorialStep.SPOTLIGHT_MOVE_TO_PANTRY;

        // Every spotlight step that targets a specific row (swipe, checkbox,
        // long-press-price target an unpurchased row; move-to-pantry targets
        // a purchased row) needs at least one matching item to point at.
        // Without this, a step reached via "Next"/skip on an empty list — or
        // one whose only qualifying item was purchased/removed/moved out
        // from under it — would fall through to a stale or absent rect.
        const needsUnpurchasedItem =
          isSwipeStep || isCheckboxStep || isLongPressStep;
        const needsPurchasedItem = isMoveToPantryStep;
        if (needsUnpurchasedItem && rawUnpurchasedItems.length === 0)
          return null;
        if (needsPurchasedItem && rawPurchasedItems.length === 0) return null;

        const stepConfig = TUTORIAL_STEP_CONFIG[tutorial.currentStep];
        if (!stepConfig) return null;

        // Belt-and-suspenders: SortableItem clears its rect on unmount/
        // no-longer-target, so this should already be null whenever the
        // item check above didn't catch it — but never render on a rect
        // that hasn't been (re)measured yet either way.
        const targetRect = tutorial.rects[stepConfig.rectKey];
        if (!targetRect) return null;

        const handleTargetPress = () => {
          if (
            tutorial.currentStep ===
            ShoppingListTutorialStep.SPOTLIGHT_ADD_BUTTON
          ) {
            Telemetry.trackEvent('add_item_from_tab_bar', {
              list_id: currentListId,
            });
            openAddItemSheet();
            tutorial.notifyAddButtonPressed();
          } else if (
            tutorial.currentStep ===
            ShoppingListTutorialStep.SPOTLIGHT_SWIPE_ACTIONS
          ) {
            // Also handled by swipe detection in SortableItem, but
            // tap-to-advance serves as fallback
            tutorial.notifySwipeActionsSeen();
          } else if (
            tutorial.currentStep === ShoppingListTutorialStep.SPOTLIGHT_CHECKBOX
          ) {
            const firstItemId = rawUnpurchasedItems?.[0]?.id;
            if (firstItemId) {
              handleTogglePurchase(firstItemId);
              tutorial.notifyCheckboxTapped();
            }
          } else if (
            tutorial.currentStep ===
            ShoppingListTutorialStep.SPOTLIGHT_LONG_PRESS_PRICE
          ) {
            // Opens the purchase-amount sheet; the tutorial advances only
            // once that sheet actually closes (wired in
            // ShoppingListModalsContext), not immediately on open.
            const firstItemId = rawUnpurchasedItems?.[0]?.id;
            if (firstItemId) {
              openPurchaseAmount(firstItemId);
            }
          } else if (
            tutorial.currentStep ===
            ShoppingListTutorialStep.SPOTLIGHT_PURCHASED_TAB
          ) {
            tutorial.notifyPurchasedTabTapped();
          } else if (
            tutorial.currentStep ===
            ShoppingListTutorialStep.SPOTLIGHT_MOVE_TO_PANTRY
          ) {
            const firstItemId = rawPurchasedItems?.[0]?.id;
            if (firstItemId) {
              openMoveToPantry(firstItemId);
              tutorial.notifyMoveToPantryTapped();
            }
          }
        };

        const handleNext = () => {
          if (
            tutorial.currentStep ===
            ShoppingListTutorialStep.SPOTLIGHT_ADD_BUTTON
          ) {
            Telemetry.trackEvent('add_item_from_tab_bar', {
              list_id: currentListId,
              source: 'tutorial',
            });
            openAddItemSheet();
            tutorial.notifyAddButtonPressed();
          } else {
            tutorial.skipCurrentStep();
          }
        };

        return (
          <SpotlightCoachMark
            targetRect={targetRect}
            title={t(stepConfig.titleKey)}
            subtitle={t(stepConfig.subtitleKey)}
            stepIndex={stepConfig.stepIndex}
            totalSteps={TUTORIAL_TOTAL_STEPS}
            onDismiss={tutorial.skipAll}
            onNext={handleNext}
            onTargetPress={handleTargetPress}
            allowGesturePassthrough={isSwipeStep}
          />
        );
      })()}

      {/* Modals are rendered inside ShoppingListModalsProvider */}
    </Screen>
  );
};

const styles = StyleSheet.create(theme => ({
  searchBarContainer: {
    paddingHorizontal: theme.spacing.base,
  },
}));
