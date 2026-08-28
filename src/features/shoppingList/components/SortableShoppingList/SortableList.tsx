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
import type { SwipeAction } from '#components/molecules/SwipeableItem/types';
import { ThemedRefreshControl } from '#components/atoms/themedComponents';
import type { SortableShoppingListProps, ShoppingListRowItem } from './types';
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
import { useCommitTracking } from '#hooks/performance/useCommitTracking';
import { useFlashListPerformance } from '#hooks/performance/useFlashListPerformance';
import { useDataReferenceTracker } from '#hooks/performance/useDataReferenceTracker';
import { FLASHLIST_DEFAULTS } from '#utils/flashListDefaults';

// Screen-relative draw distance: 2× viewport. This window spans more rows than a
// whole ITEMS_PAGE_SIZE page, so an append can mount a full page in one commit —
// costly in a debug build, but not what drops frames in release. See
// pantryDisplay/constants.ts DRAW_DISTANCE before changing it.
const DRAW_DISTANCE = Math.round(Dimensions.get('window').height * 2);

// Module-level constant — avoids creating a new object reference per render
const MVCP_DISABLED = { disabled: true };

// Module-scope functions — zero runtime overhead (no compiler tracking/comparison)
const keyExtractor = (item: ShoppingListRowItem) => item.id;
// Every row is the same component, so one recycling pool is correct.
const getItemType = () => 'item';
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
    // This list has no loading or placeholder mode — it renders whatever rows
    // it is given — so having rows is the only content signal it can honestly
    // offer. Deliberately conservative: a launch landing here on an empty list
    // emits no `app_fully_drawn_ms` rather than timing an empty frame.
    hasRealContent: items.length > 0,
    onFirstContentLayout,
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

  // A row-removing action must arm FlashList's layout animation before it runs.
  // `SwipeableItem` deliberately ignores `removesRow` — the swipe molecule has
  // no opinion about the list around it — so the list is what honours it. This
  // is where the old `onItemDelete` wrapper did the same job.
  const prepareRemovals = (
    actionList: SwipeAction[] | undefined,
  ): SwipeAction[] | undefined =>
    actionList?.map(action =>
      action.removesRow
        ? {
            ...action,
            onPress: () => {
              flashListRef.current?.prepareForLayoutAnimationRender();
              action.onPress();
            },
          }
        : action,
    );

  // Actions for context — wrap delete/toggle to prepare FlashList for layout animation
  const actions: SortableListActions = {
    onItemPress,
    itemSwipeActions: itemSwipeActions
      ? (id: string) => {
          const swipe = itemSwipeActions(id);
          return swipe
            ? {
                left: prepareRemovals(swipe.left),
                right: prepareRemovals(swipe.right),
              }
            : undefined;
        }
      : undefined,
    onTogglePurchase: onTogglePurchase
      ? (id: string, opts?: { withDetails?: boolean }) => {
          // A long-press ({ withDetails }) opens the purchase-amount sheet and
          // leaves the row in place, so only arm the layout animation for the
          // plain toggle, which moves the row to the other tab immediately.
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
              // An explicit control, NOT the bare `onRefresh`/`refreshing` pair.
              // Given only those, FlashList builds React Native's RefreshControl
              // itself (`useSecondaryProps.tsx` — `else if (onRefresh)`), and
              // RNGH's ScrollView above then hands that control its scroll
              // gesture as `block`, which RN's control silently drops. The
              // indicator ends up outside the arbitration: it hangs mid-list and
              // will not retract until the user pushes it back up by hand.
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
