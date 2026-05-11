import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
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
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { Telemetry } from '#/services/telemetry';
import { getShoppingListPermissionsWithOwner } from '#/utils/permissions/shoppingListPermissions';
import { executeRefreshWithFinally } from '#/utils/compilerSafeWrappers';

/**
 * Inner content component that uses modal context.
 * Separated to allow useShoppingListModals() to access the provider.
 */
export interface ShoppingListMainContentProps {
  screenData: ReturnType<typeof useShoppingListScreen>;
}

// NOTE: Not wrapped in React.memo — the screenData prop is a new object each render
// from useShoppingListScreen(), which defeats shallow comparison. The parent
// ShoppingListMainScreen is React.memo'd, which is the effective optimization boundary.
export const ShoppingListMainContent: React.FC<
  ShoppingListMainContentProps
> = ({ screenData }) => {
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
      searchQuery,
      totalCountUnpurchased,
      totalCountPurchased,
      hasMoreUnpurchased,
      isLoadingMoreUnpurchased,
      hasMorePurchased,
      isLoadingMorePurchased,
      isTransitioning,
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
  const { addItemSheet, quantityEdit, moveToPantry } = useShoppingListModals();

  const { toBarcode, toListSettings, toShoppingListItemDetail, toEditItem } =
    useAppNavigation();
  const { setScannerProps, scrollTabBarHidden } = useTabBarSetters();
  const { addButtonRect, isOverlayOpen } = useTabBarState();

  // ── Scroll direction tracking (tab bar hide on scroll down) ──
  const {
    scrollHandler,
    scrollEndDragHandler,
    momentumEndHandler,
    isScrolledDown,
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
    return () => {
      setIsScreenFocused(false);
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

  // --- Batch Move to Pantry Hook ---
  const { batchMoveToPantry, loading: batchMoveToPantryLoading } =
    useBatchMoveToPantry({ currentListId });

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

    const listData = {
      homeId: currentListDetails.homeId,
      collaboratorsConnection: currentListDetails.collaboratorsConnection,
      ownership: currentListDetails.ownerships?.[0],
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
      accessibilityLabel="Switch shopping list"
    >
      <Icon name="list" size={24} tone="textSecondary" />
    </Pressable>
  );

  // SearchBar rendered above tab pills (positioned above TabView in ShoppingListTabs)
  const searchBarHeader = (
    <View style={styles.searchBarContainer}>
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search shopping list..."
        showSearchIcon
      />
    </View>
  );

  const customListProps = {
    // Actions
    onTogglePurchase: handleTogglePurchase,
    onMoveToPantry: moveToPantry.openForItem,
    onQuantityPress: quantityEdit.openForItem,
    onSortOrderUpdate: handleSortOrderUpdate,
    onRefresh: handleRefresh,
    onClearAllPurchased: handleClearAllPurchased,
    onClearAllShopping: handleClearAllShopping,
    onSwipeableWillOpen: handleSwipeableWillOpen,
    onSwipeableClose: handleSwipeableClose,
    onCloseAllSwipeables: closeAll,
    onBatchMoveToPantry: batchMoveToPantry,
    // State
    loading: isLoadingInitial,
    refreshing,
    disabled: !!searchQuery.trim(),
    isTransitioning,
    batchMoveToPantryLoading,
    // Data
    unpurchasedItems,
    purchasedItems,
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
      : "You don't have permission to add items to this list",
  );

  // Empty state when no lists exist (gated on loading to prevent flash)
  if (!isLoadingInitial && lists.length === 0) {
    const noListsEmptyState = {
      icon: 'cart-outline',
      title: 'No shopping lists',
      description: 'Create a shopping list to get started',
      action: {
        label: 'Create List',
        onPress: () => toListSettings(),
      },
    };

    return (
      <TabMainScreen testID="shopping-list-screen">
        <TabScreenHeader label="Shopping list" title="Shopping List" />
        <ListTemplate items={[]} emptyState={noListsEmptyState} />
      </TabMainScreen>
    );
  }

  const emptyStateConfig = {
    icon: 'cart-outline',
    title: 'No items in this list',
    description: 'Add some items to get started',
    action: {
      label: 'Add Item',
      onPress: addItemSheet.open,
    },
  };

  return (
    <TabMainScreen testID="shopping-list-screen">
      <TabScreenHeader
        label="Shopping list"
        title={currentList?.name || 'Shopping List'}
        headerRight={headerRight}
      />
      {searchBarHeader}
      <ListTemplate
        items={[]}
        loading={isLoadingInitial}
        onItemPress={id =>
          toShoppingListItemDetail({ listId: currentListId, itemId: id })
        }
        onItemEdit={id => toEditItem({ listId: currentListId, itemId: id })}
        onItemDelete={handleDeleteItem}
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

        const stepConfig = TUTORIAL_STEP_CONFIG[tutorial.currentStep];
        if (!stepConfig) return null;

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

        const isSwipeStep =
          tutorial.currentStep ===
          ShoppingListTutorialStep.SPOTLIGHT_SWIPE_ACTIONS;

        // Don't show swipe spotlight until there is at least one item to swipe
        if (isSwipeStep && rawUnpurchasedItems.length === 0) return null;

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
            title={stepConfig.title}
            subtitle={stepConfig.subtitle}
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
