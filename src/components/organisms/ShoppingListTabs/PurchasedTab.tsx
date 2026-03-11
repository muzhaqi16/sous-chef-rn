import React, { useEffect } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import Animated, { FadeOut } from 'react-native-reanimated';
import { TIMING } from '#constants/animations';
import { SkeletonList } from '#components/base/Skeleton/SkeletonList';
import { ShoppingListItemSkeleton } from '#components/base/Skeleton/ShoppingListItemSkeleton';
import { EmptyState } from '#components/base/EmptyState';
import { useDeferredRender } from '#hooks/performance/useDeferredRender';
import { StaggeredTabContent } from './StaggeredTabContent';
import { useShoppingListTabsActions } from './ShoppingListTabsActionsContext';
import { useShoppingListData } from './ShoppingListDataContext';

// Module-level flag: once purchased tab content has been shown, skip skeletons on remount.
// Persists across component unmount/remount (stack navigation), resets on app restart.
let hasPurchasedTabShownContent = false;

const PurchasedTabComponent: React.FC = () => {
  // PERF: All data from context so renderScene in ShoppingListTabs is data-free and stable
  const actions = useShoppingListTabsActions();
  const {
    items,
    onRefresh,
    refreshing,
    loading,
    disabled,
    onEndReached,
    hasMore,
    isLoadingMore,
    canRemoveItems,
    canEditItems,
    canMarkPurchased,
    isTransitioning,
  } = useShoppingListData('purchased');
  // PERFORMANCE: Defer heavy SortableShoppingList render until after navigation completes
  // This ensures smooth screen transitions by showing skeletons during navigation animation
  const isReady = useDeferredRender();

  // Sync the module-level flag when content is truly rendered (ready, loaded, not transitioning).
  useEffect(() => {
    if (isReady && !loading && !isTransitioning) {
      hasPurchasedTabShownContent = true;
    }
  }, [isReady, loading, isTransitioning]);

  // Show skeletons only on the very first data load, before content is ready.
  const showSkeletons =
    !hasPurchasedTabShownContent && (!isReady || isTransitioning || !!loading);

  const emptyComponent = (
    <EmptyState
      icon="cart-outline"
      title="No purchased items yet"
      description="Check off items as you shop to see them here"
    />
  );

  return (
    <View style={tabStyles.container}>
      {/* Content layer — always mounted so FlashList recycling pool is preserved */}
      <View style={tabStyles.contentFill} pointerEvents={showSkeletons ? 'none' : 'auto'}>
        <StaggeredTabContent
          items={items}
          onItemPress={actions.onItemPress}
          onItemEdit={actions.onItemEdit}
          onItemDelete={actions.onItemDelete}
          onTogglePurchase={actions.onTogglePurchase}
          onMoveToPantry={actions.onMoveToPantry}
          onQuantityPress={actions.onQuantityPress}
          onRefresh={onRefresh}
          refreshing={refreshing}
          disabled={disabled}
          onSwipeableWillOpen={actions.onSwipeableWillOpen}
          onSwipeableClose={actions.onSwipeableClose}
          onEndReached={onEndReached}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          canRemoveItems={canRemoveItems}
          canEditItems={canEditItems}
          canMarkPurchased={canMarkPurchased}
          listEmptyComponent={emptyComponent}
        />
      </View>

      {/* Skeleton overlay — Reanimated exiting prop handles fade-out + unmount */}
      {showSkeletons ? (
        <Animated.View
          exiting={FadeOut.duration(TIMING.STANDARD)}
          style={tabStyles.absoluteFill}
          pointerEvents="none"
        >
          <SkeletonList SkeletonComponent={ShoppingListItemSkeleton} count={10} />
        </Animated.View>
      ) : null}
    </View>
  );
};

const tabStyles = StyleSheet.create({
  container: { flex: 1 },
  contentFill: { flex: 1 },
  absoluteFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});

export const PurchasedTab = PurchasedTabComponent;
