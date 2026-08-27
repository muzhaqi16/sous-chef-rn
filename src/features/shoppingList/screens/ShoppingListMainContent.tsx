import {
  deleteAction,
  editAction,
} from '#components/molecules/SwipeableItem/commonActions';
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
import { ListTemplate } from '#components/templates/ListTemplate';
import { TabMainScreen } from '#components/templates/TabMainScreen';
import { TabScreenHeader } from '#components/molecules/TabScreenHeader';
import { SearchBar } from '#components/molecules/SearchBar';
import { ShoppingListTabs } from '#features/shoppingList/components/ShoppingListTabs/ShoppingListTabs';
import { SpotlightCoachMark } from '#/components/organisms/SpotlightCoachMark/SpotlightCoachMark';
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
import { useShoppingListModals } from '#features/shoppingList/context/ShoppingListModalsContext';
import { useUser } from '#store/useAppStore';
import {
  useShoppingListTutorial,
  ShoppingListTutorialStep,
  TUTORIAL_STEP_CONFIG,
  TUTORIAL_TOTAL_STEPS,
} from '#features/shoppingList/context/ShoppingListTutorialContext';

// Utils
import { useApolloClient } from '@apollo/client/react';
import {
  ShoppingListCollaboratorFragmentDoc,
  ShoppingListOwnershipFragmentDoc,
  type ShoppingListCollaboratorFragment,
  type ShoppingListOwnershipFragment,
} from '#features/shoppingList/graphql/shoppingListFragments.generated';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { Telemetry } from '#/services/telemetry';
import { getShoppingListPermissionsWithOwner } from '#/utils/permissions/shoppingListPermissions';
import { executeRefreshWithFinally } from '#/utils/finallyHelpers';
import { DataStateView } from '#components/molecules/DataStateView';
import { useDataState } from '#hooks/data/useDataState';

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

  // Get modal actions from context (provided by ShoppingListModalsProvider)
  const { addItemSheet, quantityEdit, purchaseAmount, moveToPantry } =
    useShoppingListModals();

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

  const apolloClient = useApolloClient();

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
      if (isUnpurchased) purchaseAmount.openForItem(itemId);
      return;
    }
    handleTogglePurchase(itemId);
  };

  // --- Batch Move to Pantry Hook ---
  const {
    batchMoveToPantry,
    loading: batchMoveToPantryLoading,
    isApiUnavailable: batchMoveToPantryUnavailable,
  } = useBatchMoveToPantry({ currentListId });

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
    optimisticDataPersistence.clearType('ShoppingListItem');
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

  // Calculate permissions for the current list
  const permissions = (() => {
    if (!currentListDetails) {
      return {
        canAddItems: true,
        canRemoveItems: true,
        canEditItems: true,
        canMarkPurchased: true,
      };
    }

    // Build the permission input from materialized collaborator/ownership
    // fragments. Use the cache-key form (`{ __typename, id }`) — passing the
    // masked ref directly silently returns partial/null data under
    // `dataMasking: true`, which made owners of personal lists fall through
    // to NO_PERMISSIONS.
    const collaboratorNodes =
      currentListDetails.collaboratorsConnection?.edges.map(e =>
        apolloClient.cache.readFragment<ShoppingListCollaboratorFragment>({
          fragment: ShoppingListCollaboratorFragmentDoc,
          fragmentName: 'ShoppingListCollaboratorFragment',
          from: { __typename: 'ShoppingListCollaborator', id: e.node.id },
        }),
      ) ?? [];
    const ownershipRef = currentListDetails.ownerships?.[0];
    const ownershipNode = ownershipRef
      ? apolloClient.cache.readFragment<ShoppingListOwnershipFragment>({
          fragment: ShoppingListOwnershipFragmentDoc,
          fragmentName: 'ShoppingListOwnershipFragment',
          from: { __typename: 'ShoppingListOwnership', id: ownershipRef.id },
        })
      : null;
    const listData = {
      homeId: currentListDetails.homeId,
      collaboratorsConnection: {
        edges: collaboratorNodes.map(node => ({ node })),
      },
      ownership: ownershipNode,
    };

    const homeMembership = currentListDetails.home?.myMembership ?? null;

    return getShoppingListPermissionsWithOwner(
      listData,
      user?.id,
      homeMembership,
    );
  })();

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
    onMoveToPantry: moveToPantry.openForItem,
    onQuantityPress: quantityEdit.openForItem,
    onSortOrderUpdate: handleSortOrderUpdate,
    onRefresh: handleRefresh,
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
    batchMoveToPantryUnavailable,
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
      addItemSheet.open();
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
      <TabMainScreen testID="shopping-list-screen">
        <TabScreenHeader
          label={t('shoppingListScreen.label')}
          title={t('labels.shoppingList')}
        />
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
      </TabMainScreen>
    );
  }

  const emptyStateConfig = {
    icon: 'cart-outline',
    title: t('shoppingListScreen.emptyTitle'),
    description: t('shoppingListScreen.emptyDescription'),
    action: {
      label: t('labels.addItem'),
      onPress: addItemSheet.open,
    },
  };

  return (
    <TabMainScreen testID="shopping-list-screen">
      <TabScreenHeader
        label={t('shoppingListScreen.label')}
        title={currentList?.name || t('labels.shoppingList')}
        headerRight={headerRight}
      />
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
        if (
          addItemSheet.visible ||
          quantityEdit.visible ||
          purchaseAmount.visible ||
          moveToPantry.visible
        )
          return null;

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
            addItemSheet.open();
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
              purchaseAmount.openForItem(firstItemId);
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
              moveToPantry.openForItem(firstItemId);
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
            addItemSheet.open();
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
    </TabMainScreen>
  );
};

const styles = StyleSheet.create(theme => ({
  searchBarContainer: {
    paddingHorizontal: theme.spacing['3'],
  },
}));
