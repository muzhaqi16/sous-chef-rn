import React, { useEffect, useRef, useState } from 'react';
import { View, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

// Components
import { AnimatedItemSelector } from '#components/organisms/AnimatedItemSelector/AnimatedItemSelector';
import { ListTemplate } from '#components/templates/ListTemplate';
import { TabScreenHeader } from '#components/molecules/TabScreenHeader';
import { SearchBar } from '#components/molecules/SearchBar';
import { ShoppingListTabs } from '#components/organisms/ShoppingListTabs/ShoppingListTabs';
import { InteractiveSwipeHint } from '#components/organisms/InteractiveSwipeHint/InteractiveSwipeHint';
import { SpotlightCoachMark } from '#/components/organisms/SpotlightCoachMark/SpotlightCoachMark';
import { Icon } from '#utils/iconUtils';

// Hooks & Context
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useTabBarAddButton } from '#hooks/navigation/useTabBarAddButton';
import { useFeatureHint } from '#hooks/useFeatureHint';
import {
  useTutorialSequence,
  type TutorialStep,
} from '#hooks/ui/useTutorialSequence';
import type { useShoppingListScreen } from '#hooks/shoppingList/useShoppingListScreen';
import { useShoppingListActions } from '#hooks/shoppingList/useShoppingListActions';
import { useBatchMoveToPantry } from '#hooks/shoppingList/useBatchMoveToPantry';
import { useShoppingListSelectorModal } from '#hooks/shoppingList/useShoppingListSelectorModal';
import { useItemReordering } from '#hooks/shoppingList/useItemReordering';
import { useSwipeableCoordinator } from '#hooks/ui/useSwipeableCoordinator';
import {
  useTabBarSetters,
  useTabBarState,
} from '#/context/TabBarActionsContext';
import { useShoppingListModals } from '#/context/ShoppingListModalsContext';
import { useAuthUser } from '#/hooks/auth/useAuthUser';

// Utils
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { Telemetry } from '#/services/telemetry';
import { getShoppingListPermissionsWithOwner } from '#/utils/permissions/shoppingListPermissions';
import { executeRefreshWithFinally } from '#/utils/compilerSafeWrappers';

// ── Shopping list tutorial steps (data-driven, add entries to extend) ──
const SHOPPING_LIST_TUTORIAL_STEPS: TutorialStep[] = [
  {
    featureId: 'shopping_tutorial_selector',
    title: 'Manage your lists',
    subtitle: 'Create new lists and switch between them',
    rectKey: 'selectorIcon',
  },
  {
    featureId: 'shopping_tutorial_tabs',
    title: 'Switch between tabs',
    subtitle: 'View your shopping items or purchased items',
    rectKey: 'filterTabBar',
  },
  {
    featureId: 'shopping_tutorial_add',
    title: 'Add items quickly',
    subtitle: 'Tap + to add items to your shopping list',
    rectKey: 'addButton',
  },
];

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

  // Feature hint for swipe gesture (shows once, after items load)
  const swipeHint = useFeatureHint({
    featureId: 'shopping_list_swipe',
    showOnMount: false,
  });

  const { navigate, navigateTo } = useAppNavigation();
  const { setScannerProps } = useTabBarSetters();
  const { addButtonRect, isOverlayOpen } = useTabBarState();
  const { theme } = useUnistyles();

  // ── Screen focus tracking ──
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const [onScreenFocus] = useState(() => () => {
    setIsScreenFocused(true);
    return () => setIsScreenFocused(false);
  });
  useFocusEffect(onScreenFocus);

  // ── Element position tracking for tutorial spotlight ──
  type LayoutRect = { x: number; y: number; width: number; height: number };
  const selectorIconRef = useRef<View>(null);
  const [selectorIconRect, setSelectorIconRect] = useState<LayoutRect | null>(
    null,
  );
  const [filterTabBarRect, setFilterTabBarRect] = useState<LayoutRect | null>(
    null,
  );

  // Get current user for permission calculations
  const user = useAuthUser();

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

  // ── Tutorial orchestration ──
  const tutorial = useTutorialSequence({
    steps: SHOPPING_LIST_TUTORIAL_STEPS,
    targetRects: {
      selectorIcon: selectorIconRect,
      filterTabBar: filterTabBarRect,
      addButton: addButtonRect,
    },
    canStart: lists.length > 0,
    isPaused: !isScreenFocused || isOverlayOpen || swipeHint.isVisible,
  });

  // Target press actions per tutorial step
  const tutorialTargetActions: Record<number, () => void> = {
    0: handleOpenSelector,
    1: () => {
      // No specific navigation — the spotlight highlights the tab bar
    },
    2: () => {
      Telemetry.trackEvent('add_item_from_tab_bar', {
        list_id: currentListId,
      });
      addItemSheet.open();
    },
  };

  // Show swipe hint after items load
  useEffect(() => {
    if (unpurchasedItems.length > 0 && !swipeHint.hasBeenShown) {
      const timer = setTimeout(() => {
        swipeHint.actions.show();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [unpurchasedItems, swipeHint.hasBeenShown, swipeHint.actions]);

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

  // Header right action - list selector button (wrapped for tutorial measurement)
  const headerRight = (
    <View
      ref={selectorIconRef}
      collapsable={false}
      onLayout={() => {
        requestAnimationFrame(() => {
          selectorIconRef.current?.measure((_x, _y, w, h, pageX, pageY) => {
            if (w > 0 && h > 0) {
              setSelectorIconRect({ x: pageX, y: pageY, width: w, height: h });
            }
          });
        });
      }}
    >
      <Pressable
        onPress={handleOpenSelector}
        hitSlop={8}
        testID="shopping-list-selector"
        accessibilityRole="button"
        accessibilityLabel="Switch shopping list"
      >
        <Icon name="list" size={24} color={theme.colors.textSecondary} />
      </Pressable>
    </View>
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
    // Header
    listHeaderComponent: searchBarHeader,
    // Search query for search-aware empty states
    searchQuery,
    // Tutorial layout measurement
    onFilterTabBarLayout: setFilterTabBarRect,
  };

  // Set up scanner button
  useEffect(() => {
    const handleScanPress = () => {
      Telemetry.trackEvent('barcode_scanner_opened', {
        source: 'shopping_list',
        list_id: currentListId,
      });
      navigateTo.barcode({
        source: 'shoppingList',
        shoppingListId: currentListId,
      });
    };

    setScannerProps(handleScanPress, true);

    return () => {
      setScannerProps(undefined, false);
    };
  }, [setScannerProps, navigateTo, currentListId]);

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

  // Empty state when no lists exist
  if (lists.length === 0) {
    const noListsEmptyState = {
      icon: 'cart-outline',
      title: 'No shopping lists',
      description: 'Create a shopping list to get started',
      action: {
        label: 'Create List',
        onPress: () => navigate('ListSettings'),
      },
    };

    return (
      <View style={styles.container} testID="shopping-list-screen">
        <TabScreenHeader label="Shopping list" title="Shopping List" />
        <ListTemplate items={[]} emptyState={noListsEmptyState} />
      </View>
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
    <View style={styles.container} testID="shopping-list-screen">
      <TabScreenHeader
        label="Shopping list"
        title={currentList?.name || 'Shopping List'}
        headerRight={headerRight}
      />
      <ListTemplate
        items={[]}
        loading={isLoadingInitial}
        onItemPress={id =>
          navigate('ItemDetail', { listId: currentListId, itemId: id })
        }
        onItemEdit={id =>
          navigate('EditItem', { listId: currentListId, itemId: id })
        }
        onItemDelete={handleDeleteItem}
        onRefresh={handleRefresh}
        testIDPrefix="shopping-list-item"
        emptyState={emptyStateConfig}
        customListComponent={ShoppingListTabs}
        customListProps={customListProps}
      />

      <AnimatedItemSelector
        ref={selectorRef}
        config={listConfig}
        onOpen={handleOverlayOpen}
        onClose={handleOverlayClose}
      />

      {/* Interactive swipe tutorial */}
      {!!swipeHint.isVisible && (
        <InteractiveSwipeHint
          mode="shopping"
          onDismiss={swipeHint.actions.dismiss}
        />
      )}

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

      {/* Modals are rendered inside ShoppingListModalsProvider */}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  searchBarContainer: {
    paddingHorizontal: theme.spacing.md,
  },
}));
