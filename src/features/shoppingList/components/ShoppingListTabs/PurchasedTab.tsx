import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native-unistyles';
import Animated, { FadeOut } from 'react-native-reanimated';
import { TIMING } from '#constants/animations';
import { SkeletonList } from '#components/base/Skeleton/SkeletonList';
import { ShoppingListItemSkeleton } from '#components/base/Skeleton/ShoppingListItemSkeleton';
import { EmptyState } from '#components/base/EmptyState';
import { useDeferredRender } from '#hooks/performance/useDeferredRender';
import { useMinimumVisible } from '#hooks/ui/useMinimumVisible';
import { StaggeredTabContent } from './StaggeredTabContent';
import { useShoppingListTabsActions } from './ShoppingListTabsActionsContext';
import {
  useShoppingListData,
  useShoppingListSearchQuery,
} from './ShoppingListDataContext';

// Module-level flag: once purchased tab content has been shown, skip skeletons on remount.
// Persists across component unmount/remount (stack navigation), resets on app restart.
let hasPurchasedTabShownContent = false;

const PurchasedTabComponent: React.FC = () => {
  // PERF: All data from context so renderScene in ShoppingListTabs is data-free and stable
  const actions = useShoppingListTabsActions();
  const {
    items,
    showImages,
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
    onScroll,
    onScrollEndDrag,
    onMomentumScrollEnd,
    scrollEventThrottle,
    listHeaderComponent,
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
  // The minimum-visible latch keeps a fast cache-warm load from flashing them
  // for a sub-perceptible frame; when content is ready immediately it never arms.
  const rawShowSkeletons =
    !hasPurchasedTabShownContent && (!isReady || isTransitioning || !!loading);
  const showSkeletons = useMinimumVisible(rawShowSkeletons);

  const { t } = useTranslation();
  const searchQuery = useShoppingListSearchQuery();

  const displayQuery =
    searchQuery.length > 30 ? searchQuery.slice(0, 30) + '...' : searchQuery;

  const emptyComponent = searchQuery.trim() ? (
    <EmptyState
      icon="search-outline"
      title={t('shoppingListScreens.searchNoResultsTitle', {
        query: displayQuery,
      })}
      description={t('shoppingListScreens.purchasedSearchNoMatch')}
    />
  ) : (
    <EmptyState
      icon="cart-outline"
      title={t('shoppingListScreens.purchasedEmptyTitle')}
      description={t('shoppingListScreens.purchasedEmptyDescription')}
    />
  );

  return (
    <View style={tabStyles.container}>
      {/* Content layer — always mounted so FlashList recycling pool is preserved */}
      <View
        style={tabStyles.contentFill}
        pointerEvents={showSkeletons ? 'none' : 'auto'}
      >
        <StaggeredTabContent
          items={items}
          showImages={showImages}
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
          onScroll={onScroll}
          onScrollEndDrag={onScrollEndDrag}
          onMomentumScrollEnd={onMomentumScrollEnd}
          scrollEventThrottle={scrollEventThrottle}
          listHeaderComponent={listHeaderComponent}
        />
      </View>

      {/* Skeleton overlay — Reanimated exiting prop handles fade-out + unmount */}
      {showSkeletons ? (
        <Animated.View
          exiting={FadeOut.duration(TIMING.STANDARD)}
          style={tabStyles.absoluteFill}
          pointerEvents="none"
        >
          <SkeletonList
            SkeletonComponent={ShoppingListItemSkeleton}
            count={10}
          />
        </Animated.View>
      ) : null}
    </View>
  );
};

const tabStyles = StyleSheet.create(theme => ({
  container: { flex: 1 },
  contentFill: { flex: 1 },
  absoluteFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.background,
  },
}));

export const PurchasedTab = PurchasedTabComponent;
