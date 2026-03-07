import React, { useEffect, useState } from 'react';
import { View, Pressable } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

// Components
import { AnimatedItemSelector } from '#components/organisms/AnimatedItemSelector/AnimatedItemSelector';
import { ListTemplate } from '#components/templates/ListTemplate';
import { TabScreenHeader } from '#components/molecules/TabScreenHeader';
import { SearchBar } from '#components/molecules/SearchBar';
import { ShoppingListTabs } from '#components/organisms/ShoppingListTabs/ShoppingListTabs';
import { SwipeHintOverlay } from '#components/organisms/SwipeHintOverlay';
import { Icon } from '#utils/iconUtils';

// Hooks & Context
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useTabBarAddButton } from '#hooks/navigation/useTabBarAddButton';
import { useFeatureHint } from '#hooks/useFeatureHint';
import type { useShoppingListScreen } from '#hooks/shoppingList/useShoppingListScreen';
import { useShoppingListActions } from '#hooks/shoppingList/useShoppingListActions';
import { useBatchMoveToPantry } from '#hooks/shoppingList/useBatchMoveToPantry';
import { useShoppingListSelectorModal } from '#hooks/shoppingList/useShoppingListSelectorModal';
import { useItemReordering } from '#hooks/shoppingList/useItemReordering';
import { useSwipeableCoordinator } from '#hooks/ui/useSwipeableCoordinator';
import { useTabBarSetters } from '#/context/TabBarActionsContext';
import { useShoppingListModals } from '#/context/ShoppingListModalsContext';
import { useAuth } from '#/hooks/auth/useAuth';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { useScreenTelemetry } from '#hooks/performance/useScreenTelemetry';

// Utils
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { Telemetry } from '#/services/telemetry';
import { getShoppingListPermissionsWithOwner } from '#/utils/permissions/shoppingListPermissions';
import { executeRefreshWithFinally } from '#/utils/compilerSafeWrappers';
import { preloadImages } from '#components/atoms/CachedImage';

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
export const ShoppingListMainContent: React.FC<ShoppingListMainContentProps> =
  ({ screenData }) => {
    const {
      lists,
      listDataWithOwnership,
      currentList,
      currentListDetails,
      currentListId,
      items,
      sortableItems,
      unpurchasedItems,
      purchasedItems,
      rawUnpurchasedItems,
      isLoadingInitial,
      searchQuery,
      setSearchQuery,
      addItem,
      toggleItem,
      removeItem,
      refetch: refetchItems,
      totalCountUnpurchased,
      totalCountPurchased,
      loadMoreUnpurchased,
      hasMoreUnpurchased,
      isLoadingMoreUnpurchased,
      loadMorePurchased,
      hasMorePurchased,
      isLoadingMorePurchased,
      setSelectedShoppingListId,
      isTransitioning } = screenData;

    // Get modal actions from context (provided by ShoppingListModalsProvider)
    const { addItemSheet, quantityEdit, moveToPantry } =
      useShoppingListModals();

    // Feature hint for swipe gesture (shows once, after items load)
    const swipeHint = useFeatureHint({
      featureId: 'shopping_list_swipe',
      showOnMount: false });

    const { navigate, navigateTo } = useAppNavigation();
    const { setScannerProps } = useTabBarSetters();
    const { theme } = useUnistyles();

    // Get current user for permission calculations
    const { user } = useAuth();

    // Track screen performance
    useScreenTransition('ShoppingListMain');

    // --- Actions Hook ---
    const {
      handleTogglePurchase,
      handleDeleteItem,
      handleClearAllPurchased,
      handleClearAllShopping } = useShoppingListActions({
      currentListId,
      items,
      addItem,
      toggleItem,
      removeItem,
      refetchItems,
      setSearchQuery });

    // --- Batch Move to Pantry Hook ---
    const { batchMoveToPantry, loading: batchMoveToPantryLoading } =
      useBatchMoveToPantry({ currentListId });

    // --- Reordering Hook ---
    const { handleSortOrderUpdate: reorderItem } = useItemReordering({
      listId: currentListId,
      items: rawUnpurchasedItems,
      refetch: refetchItems });

    const handleSortOrderUpdate = (
        itemId: string,
        afterItemId: string | null,
        beforeItemId: string | null,
      ) => {
        reorderItem(itemId, afterItemId, beforeItemId, null, null);
      };

    // --- Selector Hook ---
    const {
      selectorRef,
      listConfig,
      handleOpenSelector,
      handleOverlayOpen,
      handleOverlayClose } = useShoppingListSelectorModal({
      listDataWithOwnership,
      currentListId,
      setSelectedShoppingListId });

    // Local state
    const [refreshing, setRefreshing] = useState(false);

    // Coordinate swipeable items so only one is open at a time
    const { handleSwipeableWillOpen, handleSwipeableClose, closeAll } = useSwipeableCoordinator();

    // Show swipe hint after items load
    useEffect(() => {
      if (items.length > 0 && !swipeHint.hasBeenShown) {
        const unpurchasedForHint = items.filter(
          (item: any) => !item.purchaseInfo?.isPurchased,
        );
        if (unpurchasedForHint.length > 0) {
          const timer = setTimeout(() => {
            swipeHint.actions.show();
          }, 1500);
          return () => clearTimeout(timer);
        }
      }
    }, [items, swipeHint.hasBeenShown, swipeHint.actions]);

    // Preload item images so they're cached before scrolling into view
    useEffect(() => {
      const urls: string[] = [];
      for (const item of sortableItems) {
        if (item.leftElementConfig?.url) urls.push(item.leftElementConfig.url);
      }
      if (urls.length > 0) preloadImages(urls);
    }, [sortableItems]);

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
          canMarkPurchased: true };
      }

      const listData = {
        homeId: currentListDetails.homeId,
        collaboratorsConnection: currentListDetails.collaboratorsConnection,
        ownership: currentListDetails.ownerships?.[0] };

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
          <Icon
            name="list"
            size={24}
            color={theme.colors.textSecondary}
          />
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

    // PERFORMANCE: Split customListProps into stable groups so each group is independently
    // memoized. When only one group changes (e.g. refreshing), the others retain references.
    const listActions = ({
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
      onBatchMoveToPantry: batchMoveToPantry });

    const listState = ({
      loading: isLoadingInitial,
      refreshing,
      disabled: !!searchQuery.trim(),
      isTransitioning,
      batchMoveToPantryLoading });

    const listData = ({
      unpurchasedItems,
      purchasedItems,
      totalCountUnpurchased,
      totalCountPurchased });

    const paginationState = ({
      onEndReachedUnpurchased: loadMoreUnpurchased,
      hasMoreUnpurchased,
      isLoadingMoreUnpurchased,
      onEndReachedPurchased: loadMorePurchased,
      hasMorePurchased,
      isLoadingMorePurchased });

    const permissionsState = ({
      canAddItems: permissions.canAddItems,
      canRemoveItems: permissions.canRemoveItems,
      canEditItems: permissions.canEditItems,
      canMarkPurchased: permissions.canMarkPurchased,
      canReorderItems: permissions.canEditItems });

    const customListProps = ({
      ...listActions,
      ...listState,
      ...listData,
      ...paginationState,
      ...permissionsState,
      listHeaderComponent: searchBarHeader });

    // Track screen view once on mount (avoid re-firing on every item/list change)
    useScreenTelemetry('ShoppingListMain', () => ({
      list_id: currentListId,
      item_count: (totalCountUnpurchased ?? 0) + (totalCountPurchased ?? 0),
      purchased_count: totalCountPurchased ?? 0,
      has_lists: lists.length > 0 }));

    // Set up scanner button
    useEffect(() => {
      const handleScanPress = () => {
        Telemetry.trackEvent('barcode_scanner_opened', {
          source: 'shopping_list',
          list_id: currentListId });
        navigateTo.barcode({
          source: 'shoppingList',
          shoppingListId: currentListId });
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
          list_id: currentListId });
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
        icon: 'cart-outline' as const,
        title: 'No shopping lists',
        description: 'Create a shopping list to get started',
        action: {
          label: 'Create List',
          onPress: () => navigate('ListSettings') } };

      return (
        <View style={styles.container} testID="shopping-list-screen">
          <TabScreenHeader
            label="Shopping list"
            title="Shopping List"
          />
          <ListTemplate
            items={[]}
            emptyState={noListsEmptyState}
          />
        </View>
      );
    }

    const emptyStateConfig = {
      icon: 'cart-outline' as const,
      title: 'No items in this list',
      description: 'Add some items to get started',
      action: {
        label: 'Add Item',
        onPress: addItemSheet.open } };

    return (
      <View style={styles.container} testID="shopping-list-screen">
        <TabScreenHeader
          label="Shopping list"
          title={currentList?.name || 'Shopping List'}
          headerRight={headerRight}
        />
        <ListTemplate
          items={sortableItems}
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

        {/* Swipe gesture hint overlay */}
        {!!swipeHint.isVisible && <SwipeHintOverlay onDismiss={swipeHint.actions.dismiss} />}

        {/* Modals are rendered inside ShoppingListModalsProvider */}
      </View>
    );
  };

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background },
  searchBarContainer: {
    paddingHorizontal: theme.spacing.md } }));
