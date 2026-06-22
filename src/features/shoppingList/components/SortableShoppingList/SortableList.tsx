import React, { useRef } from 'react';
import { View, Dimensions, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSwipeableCoordinator } from '#hooks/ui/useSwipeableCoordinator';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import {
  FlashList,
  type FlashListRef,
  type ListRenderItemInfo,
} from '@shopify/flash-list';
import type { SortableShoppingListProps, ShoppingListRowItem } from './types';
import { AnimatedCellRenderer } from '#components/atoms/AnimatedCellRenderer';
import { SwipeableListItem } from './SortableItem';
import {
  SortableListActionsProvider,
  type SortableListActions,
  type SortableListPermissions,
} from './SortableListActionsContext';
import {
  SortableListThemeContext,
  ShoppingListRowOptionsContext,
  type SortableListThemeColors,
  type ShoppingListRowOptions,
} from './SortableListThemeContext';
import { getTabBarBottomPadding } from '#constants/layout';
import { useRenderTime } from '#hooks/performance/useRenderTime';
import { useFlashListPerformance } from '#hooks/performance/useFlashListPerformance';
import { useDataReferenceTracker } from '#hooks/performance/useDataReferenceTracker';
import { FLASHLIST_DEFAULTS } from '#utils/flashListDefaults';

// Screen-relative draw distance: 2× viewport gives ~17 items of buffer at
// ~95px/item. Provides better scroll coverage while keeping pagination cost
// manageable.
const DRAW_DISTANCE = Math.round(Dimensions.get('window').height * 2);

// Module-level constant — avoids creating a new object reference per render
const MVCP_DISABLED = { disabled: true };

// Module-scope functions — zero runtime overhead (no compiler tracking/comparison)
const keyExtractor = (item: ShoppingListRowItem) => item.id;
const renderItem = (info: ListRenderItemInfo<ShoppingListRowItem>) => {
  // FlashList v2 can transiently invoke renderItem with an undefined item while
  // recycling cells during a data swap (e.g. switching the active list). Guard
  // here so the row never dereferences an undefined item (`item.itemRef`).
  if (!info.item) return null;
  return <SwipeableListItem {...info} />;
};
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
  onEndReachedThreshold = FLASHLIST_DEFAULTS.fullScreen.onEndReachedThreshold,
  ListEmptyComponent,
  showImages = true,
  onScroll,
  onScrollBeginDrag,
  onScrollEndDrag,
  onMomentumScrollEnd,
  scrollEventThrottle,
}) => {
  useRenderTime('SortableShoppingList', { slowThreshold: 1000 });
  const flashListRef = useRef<FlashListRef<ShoppingListRowItem>>(null);

  const perfCallbacks = useFlashListPerformance(flashListRef, {
    componentName: 'SortableShoppingList',
    reportInterval: 10000,
  });
  useDataReferenceTracker(
    items,
    'SortableList.items',
    perfCallbacks.onDataReferenceChange,
  );

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
  const handleSwipeableWillOpen =
    externalOnSwipeableWillOpen ?? internalCoordinator.handleSwipeableWillOpen;
  const handleSwipeableClose =
    externalOnSwipeableClose ?? internalCoordinator.handleSwipeableClose;

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
    flexGrow: 1,
  };

  const rowOptions: ShoppingListRowOptions = { showImages };

  return (
    <SortableListThemeContext.Provider value={themeColors}>
      <ShoppingListRowOptionsContext.Provider value={rowOptions}>
        <SortableListActionsProvider
          actions={actions}
          permissions={permissions}
        >
          <View style={styles.container}>
            <FlashList<ShoppingListRowItem>
              ref={flashListRef}
              CellRendererComponent={AnimatedCellRenderer}
              data={items}
              extraData={`${disabled}-${canRemoveItems}-${canEditItems}-${canMarkPurchased}-${canReorderItems}`}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
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
              onScroll={onScroll}
              onScrollBeginDrag={onScrollBeginDrag}
              onScrollEndDrag={onScrollEndDrag}
              onMomentumScrollEnd={onMomentumScrollEnd}
              scrollEventThrottle={scrollEventThrottle}
              onRefresh={onRefresh}
              refreshing={refreshing}
              maintainVisibleContentPosition={MVCP_DISABLED}
            />
          </View>
        </SortableListActionsProvider>
      </ShoppingListRowOptionsContext.Provider>
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
