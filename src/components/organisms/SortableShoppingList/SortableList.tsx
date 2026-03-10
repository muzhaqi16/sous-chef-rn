import React, { useRef } from 'react';
import { View, Dimensions, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSwipeableCoordinator } from '#hooks/ui/useSwipeableCoordinator';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import {
  FlashList,
  type FlashListRef,
  type ListRenderItemInfo } from '@shopify/flash-list';
import type {
  SortableShoppingListProps,
  SortableShoppingListItem } from './types';
import { AnimatedCellRenderer } from '#components/atoms/AnimatedCellRenderer';
import { SwipeableListItem } from './SortableItem';
import {
  SortableListActionsProvider,
  type SortableListActions,
  type SortableListPermissions } from './SortableListActionsContext';
import {
  SortableListThemeContext,
  type SortableListThemeColors } from './SortableListThemeContext';
import { getTabBarBottomPadding } from '#constants/layout';
import { useRenderTime } from '#hooks/performance/useRenderTime';
import { useFlashListPerformance } from '#hooks/performance/useFlashListPerformance';
import { useDataReferenceTracker } from '#hooks/performance/useDataReferenceTracker';

// Screen-relative draw distance: scales with viewport so buffer stays ~7-10 items
// regardless of device size (vs fixed 250 which is ~3.7 items on most devices)
const DRAW_DISTANCE = Math.round(Dimensions.get('window').height * 0.75);

// Module-scope functions — zero runtime overhead (no compiler tracking/comparison)
const keyExtractor = (item: SortableShoppingListItem) => item.id;
const renderItem = (info: ListRenderItemInfo<SortableShoppingListItem>) => (
  <SwipeableListItem {...info} />
);
const getItemType = (item: SortableShoppingListItem) =>
  item.isPurchased ? 'purchased' : 'shopping';

const SortableShoppingListComponent: React.FC<SortableShoppingListProps> = ({
  items,
  onItemPress,
  onItemEdit,
  onItemDelete,
  onTogglePurchase,
  onMoveToPantry,
  onQuantityPress,
  onSortOrderUpdate,
  disabled = false,
  ListHeaderComponent,
  ListFooterComponent,
  onSwipeableWillOpen: externalOnSwipeableWillOpen,
  onSwipeableClose: externalOnSwipeableClose,
  onRefresh,
  refreshing = false,
  canRemoveItems = true,
  canEditItems = true,
  canMarkPurchased = true,
  canReorderItems = false,
  onEndReached,
  onEndReachedThreshold = 0.5,
  ListEmptyComponent,
}) => {
  useRenderTime('SortableShoppingList', { slowThreshold: 1000 });
  const flashListRef = useRef<FlashListRef<SortableShoppingListItem>>(null);

  const perfCallbacks = useFlashListPerformance(flashListRef, {
    componentName: 'SortableShoppingList',
    reportInterval: 10000,
  });
  useDataReferenceTracker(items, 'SortableList.items', perfCallbacks.onDataReferenceChange);

  // PERFORMANCE: Single useUnistyles call for entire list
  const { theme } = useUnistyles();
  // PERFORMANCE: Single useWindowDimensions call - shared via context to avoid N subscriptions in items
  const { width: screenWidth } = useWindowDimensions();
  const themeColors: SortableListThemeColors = {
    primary: theme.colors.primary,
    textPrimary: theme.colors.textPrimary,
    textSecondary: theme.colors.textSecondary,
    surfaceVariant: theme.colors.surfaceVariant,
    surface: theme.colors.surface,
    border: theme.colors.border,
    screenWidth,
  };

  // Safe area insets for bottom padding
  const insets = useSafeAreaInsets();

  // Coordinate swipeable items — use external coordinator if provided, otherwise internal fallback
  const internalCoordinator = useSwipeableCoordinator();
  const handleSwipeableWillOpen = externalOnSwipeableWillOpen ?? internalCoordinator.handleSwipeableWillOpen;
  const handleSwipeableClose = externalOnSwipeableClose ?? internalCoordinator.handleSwipeableClose;

  // Actions for context — wrap delete/toggle to prepare FlashList for layout animation
  const actions: SortableListActions = {
    onItemPress,
    onItemEdit,
    onItemDelete: onItemDelete
      ? (id: string) => {
          flashListRef.current?.prepareForLayoutAnimationRender();
          onItemDelete(id);
        }
      : undefined,
    onTogglePurchase: onTogglePurchase
      ? (id: string) => {
          flashListRef.current?.prepareForLayoutAnimationRender();
          onTogglePurchase(id);
        }
      : undefined,
    onMoveToPantry,
    onQuantityPress,
    onSwipeableWillOpen: handleSwipeableWillOpen,
    onSwipeableClose: handleSwipeableClose,
    onSortOrderUpdate,
  };

  const permissions: SortableListPermissions = {
    canRemoveItems,
    canEditItems,
    canMarkPurchased,
    canReorderItems,
    disabled,
  };

  // React Compiler auto-memoizes based on insets.bottom dependency
  const contentContainerStyle = {
    paddingTop: 8,
    paddingBottom: getTabBarBottomPadding(insets.bottom),
  };

  return (
    <SortableListThemeContext.Provider value={themeColors}>
      <SortableListActionsProvider
        actions={actions}
        permissions={permissions}
      >
        <View style={styles.container}>
          <FlashList<SortableShoppingListItem>
            ref={flashListRef}
            CellRendererComponent={AnimatedCellRenderer}
            data={items}
            extraData={`${disabled}-${canRemoveItems}-${canEditItems}-${canMarkPurchased}-${canReorderItems}`}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            getItemType={getItemType}

            showsVerticalScrollIndicator={false}
            contentContainerStyle={contentContainerStyle}
            ListHeaderComponent={ListHeaderComponent ?? undefined}
            ListFooterComponent={ListFooterComponent ?? undefined}
            ListEmptyComponent={ListEmptyComponent ?? undefined}
            onEndReached={onEndReached}
            onEndReachedThreshold={onEndReachedThreshold}
            onLoad={perfCallbacks.onLoad}
            onViewableItemsChanged={perfCallbacks.onViewableItemsChanged}
            drawDistance={DRAW_DISTANCE}
            maxItemsInRecyclePool={15}
            onRefresh={onRefresh}
            refreshing={refreshing}
            maintainVisibleContentPosition={{ disabled: true }}
          />
        </View>
      </SortableListActionsProvider>
    </SortableListThemeContext.Provider>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
}));

export const SortableShoppingList = SortableShoppingListComponent;
