import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { StyleSheet } from 'react-native-unistyles';
import Animated, { FadeOut } from 'react-native-reanimated';
import { TIMING } from '#constants/animations';
import { SkeletonList } from '#components/atoms/Skeleton/SkeletonList';
import { ShoppingListItemSkeleton } from '#features/shoppingList/components/skeletons/ShoppingListItemSkeleton';
import { EmptyState } from '#components/atoms/EmptyState';
import { ShoppingEmptyIllustration } from '#components/atoms/ShoppingEmptyIllustration';
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

  // First FlashList layout commit with rows visible. Data being ready is NOT
  // rows being visible: FlashList holds every cell at `opacity: 0` through its
  // progressive first layout (~200 ms of blank on a mid-range device), so the
  // overlay releases on this signal instead of on the loading flags. A settled
  // EMPTY list never fires it (the list's `hasRealContent` is `items.length >
  // 0`), which is why the conditions below always pair it with a length check
  // — otherwise an empty tab would hold skeletons forever.
  const [listPainted, setListPainted] = useState(false);
  const handleFirstContentLayout = () => setListPainted(true);

  // Sync the module-level flag when content is truly rendered (ready, loaded,
  // not transitioning, and — when there are rows — actually painted).
  useEffect(() => {
    if (
      isReady &&
      !loading &&
      !isTransitioning &&
      (items.length === 0 || listPainted)
    ) {
      hasShoppingTabShownContent = true;
    }
  }, [isReady, loading, isTransitioning, items.length, listPainted]);

  // Show skeletons only on the very first data load, before content is ready
  // AND painted. The minimum-visible latch keeps a fast cache-warm load from
  // flashing them for a sub-perceptible frame; when content is ready
  // immediately it never arms.
  const rawShowSkeletons =
    !hasShoppingTabShownContent &&
    (!isReady ||
      isTransitioning ||
      !!loading ||
      (items.length > 0 && !listPainted));
  const showSkeletons = useMinimumVisible(rawShowSkeletons);

  const { t } = useTranslation();
  const searchQuery = useShoppingListSearchQuery();
  const { addItemSheet } = useShoppingListModals();

  const displayQuery =
    searchQuery.length > 30 ? searchQuery.slice(0, 30) + '...' : searchQuery;

  const emptyComponent = searchQuery.trim() ? (
    <EmptyState
      icon="search-outline"
      title={t('empty.noResultsFor', {
        query: displayQuery,
      })}
      description={t('shoppingListScreens.searchAddPrompt')}
      action={{
        label: t('labels.addItem'),
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
          itemSwipeActions={actions.itemSwipeActions}
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
          onFirstContentLayout={handleFirstContentLayout}
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
