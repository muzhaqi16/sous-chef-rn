import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native-unistyles';
import Animated, { FadeOut } from 'react-native-reanimated';
import { TIMING } from '#constants/animations';
import { SkeletonList } from '#components/base/Skeleton/SkeletonList';
import { ShoppingListItemSkeleton } from '#components/base/Skeleton/ShoppingListItemSkeleton';
import { EmptyState } from '#components/base/EmptyState';
import { ShoppingEmptyIllustration } from '#components/base/ShoppingEmptyIllustration';
import { useDeferredRender } from '#hooks/performance/useDeferredRender';
import { useMinimumVisible } from '#hooks/ui/useMinimumVisible';
import { StaggeredTabContent } from './StaggeredTabContent';
import { useShoppingListTabsActions } from './ShoppingListTabsActionsContext';
import {
  useShoppingListData,
  useShoppingListSearchQuery,
} from './ShoppingListDataContext';
import { useShoppingListModals } from '#features/shoppingList/context/ShoppingListModalsContext';

// Module-level flag: once shopping tab content has been shown, skip skeletons on remount.
// Persists across component unmount/remount (stack navigation), resets on app restart.
let hasShoppingTabShownContent = false;

const ShoppingTabComponent: React.FC = () => {
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
    canReorderItems,
    isTransitioning,
    onScroll,
    onScrollBeginDrag,
    onScrollEndDrag,
    onMomentumScrollEnd,
    scrollEventThrottle,
    listHeaderComponent,
  } = useShoppingListData('shopping');
  // PERFORMANCE: Defer heavy SortableShoppingList render until after navigation completes
  // This ensures smooth screen transitions by showing skeletons during navigation animation
  const isReady = useDeferredRender();

  // Sync the module-level flag when content is truly rendered (ready, loaded, not transitioning).
  useEffect(() => {
    if (isReady && !loading && !isTransitioning) {
      hasShoppingTabShownContent = true;
    }
  }, [isReady, loading, isTransitioning]);

  // Show skeletons only on the very first data load, before content is ready.
  // The minimum-visible latch keeps a fast cache-warm load from flashing them
  // for a sub-perceptible frame; when content is ready immediately it never arms.
  const rawShowSkeletons =
    !hasShoppingTabShownContent && (!isReady || isTransitioning || !!loading);
  const showSkeletons = useMinimumVisible(rawShowSkeletons);

  const { t } = useTranslation();
  const searchQuery = useShoppingListSearchQuery();
  const { addItemSheet } = useShoppingListModals();

  const displayQuery =
    searchQuery.length > 30 ? searchQuery.slice(0, 30) + '...' : searchQuery;

  const emptyComponent = searchQuery.trim() ? (
    <EmptyState
      icon="search-outline"
      title={t('shoppingListScreens.searchNoResultsTitle', {
        query: displayQuery,
      })}
      description={t('shoppingListScreens.searchAddPrompt')}
      action={{
        label: t('shoppingListScreens.addItem'),
        onPress: addItemSheet.open,
      }}
    />
  ) : (
    <EmptyState
      icon={<ShoppingEmptyIllustration size="medium" />}
      title={t('shoppingListScreens.emptyTitle')}
      description={t('shoppingListScreens.emptyDescription')}
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
          onQuantityPress={actions.onQuantityPress}
          onSortOrderUpdate={actions.onSortOrderUpdate}
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
          canReorderItems={canReorderItems}
          listEmptyComponent={emptyComponent}
          onScroll={onScroll}
          onScrollBeginDrag={onScrollBeginDrag}
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

export const ShoppingTab = ShoppingTabComponent;
