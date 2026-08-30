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
import { SwipeAwareScrollComponent } from '#components/atoms/SwipeAwareScrollComponent';
import { ThemedRefreshControl } from '#components/atoms/themedComponents';
import type { SortableShoppingListProps, ShoppingListRowItem } from './types';
import { SwipeableListItem } from './SortableItem';
import { ItemSwipeActionsProvider } from '#components/organisms/itemSwipeActionsContext';
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
import { useCommitTracking } from '#hooks/performance/useCommitTracking';
import { useFlashListPerformance } from '#hooks/performance/useFlashListPerformance';
import { useDataReferenceTracker } from '#hooks/performance/useDataReferenceTracker';
import { FLASHLIST_DEFAULTS } from '#utils/flashListDefaults';

// 2× viewport — wider than one ITEMS_PAGE_SIZE, so an append can mount a whole
// page in one commit. Read pantryDisplay/constants.ts DRAW_DISTANCE first.
const DRAW_DISTANCE = Math.round(Dimensions.get('window').height * 2);

// Module scope: one stable reference each, nothing for the compiler to track.
const MVCP_DISABLED = { disabled: true };
const keyExtractor = (item: ShoppingListRowItem) => item.id;
// Every row is the same component, so one recycling pool is correct.
const getItemType = () => 'item';
const renderItem = (info: ListRenderItemInfo<ShoppingListRowItem>) => {
  // FlashList v2 can transiently pass an undefined item while recycling cells
  // through a data swap (switching the active list).
  if (!info.item) return null;
  return <SwipeableListItem {...info} />;
};
const SortableShoppingListComponent: React.FC<SortableShoppingListProps> = ({
  items,
  onItemPress,
  itemSwipeActions,
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
  onFirstContentLayout,
}) => {
  useCommitTracking('SortableShoppingList');
  const flashListRef = useRef<FlashListRef<ShoppingListRowItem>>(null);

  const perfCallbacks = useFlashListPerformance(flashListRef, {
    componentName: 'SortableShoppingList',
    reportInterval: 10000,
    // The list has no placeholder mode, so having rows is its only honest
    // content signal: an empty list emits no `app_fully_drawn_ms` at all.
    hasRealContent: items.length > 0,
    onFirstContentLayout,
  });
  useDataReferenceTracker(
    items,
    'SortableList.items',
    perfCallbacks.onDataReferenceChange,
  );

  // One theme + dimensions subscription for the whole list, shared to rows via
  // context instead of N per-row subscriptions.
  const { theme } = useUnistyles();
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

  const insets = useSafeAreaInsets();

  const internalCoordinator = useSwipeableCoordinator();
  const handleSwipeableWillOpen =
    externalOnSwipeableWillOpen ?? internalCoordinator.handleSwipeableWillOpen;
  const handleSwipeableClose =
    externalOnSwipeableClose ?? internalCoordinator.handleSwipeableClose;

  const actions: SortableListActions = {
    onItemPress,
    // The row calls this before a `removesRow` action; only the list knows how
    // to prepare itself for the layout animation.
    onBeforeRowRemoved: () => {
      flashListRef.current?.prepareForLayoutAnimationRender();
    },
    onTogglePurchase: onTogglePurchase
      ? (id: string, opts?: { withDetails?: boolean }) => {
          // A long-press leaves the row in place; only the plain toggle moves
          // it to the other tab, so only that arms the layout animation.
          if (!opts?.withDetails) {
            flashListRef.current?.prepareForLayoutAnimationRender();
          }
          onTogglePurchase(id, opts);
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
          {/* A value, not a ref: rows read the current one as they render. */}
          <ItemSwipeActionsProvider value={itemSwipeActions}>
            <View style={styles.container}>
              <FlashList<ShoppingListRowItem>
                renderScrollComponent={SwipeAwareScrollComponent}
                ref={flashListRef}
                CellRendererComponent={perfCallbacks.CellRendererComponent}
                data={items}
                extraData={`${disabled}-${canRemoveItems}-${canEditItems}-${canMarkPurchased}-${canReorderItems}`}
                keyExtractor={keyExtractor}
                getItemType={getItemType}
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
                onCommitLayoutEffect={perfCallbacks.onCommitLayoutEffect}
                drawDistance={DRAW_DISTANCE}
                maxItemsInRecyclePool={
                  FLASHLIST_DEFAULTS.fullScreen.maxItemsInRecyclePool
                }
                onScroll={onScroll}
                onScrollBeginDrag={onScrollBeginDrag}
                onScrollEndDrag={onScrollEndDrag}
                onMomentumScrollEnd={onMomentumScrollEnd}
                scrollEventThrottle={scrollEventThrottle}
                // An explicit RNGH control, NOT a bare `onRefresh`/`refreshing`
                // pair: given those, FlashList builds RN's RefreshControl, which
                // drops the `block` scroll gesture RNGH's ScrollView hands it —
                // the indicator then hangs mid-list and never retracts.
                refreshControl={
                  onRefresh ? (
                    <ThemedRefreshControl
                      refreshing={refreshing}
                      onRefresh={onRefresh}
                    />
                  ) : undefined
                }
                maintainVisibleContentPosition={MVCP_DISABLED}
              />
            </View>
          </ItemSwipeActionsProvider>
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
