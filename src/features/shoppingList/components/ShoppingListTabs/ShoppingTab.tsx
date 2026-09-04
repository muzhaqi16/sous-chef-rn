import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { StyleSheet } from 'react-native-unistyles';
import Animated, { FadeOut } from 'react-native-reanimated';

import { SkeletonList } from '#features/shoppingList/components/SkeletonList';
import { ShoppingListItemSkeleton } from '#features/shoppingList/components/skeletons/ShoppingListItemSkeleton';
import { EmptyState } from '#components/molecules/EmptyState';
import { ShoppingEmptyIllustration } from '#features/shoppingList/components/ShoppingEmptyIllustration';
import { useDeferredRender } from '#hooks/performance/useDeferredRender';
import { useMinimumVisible } from '#features/shoppingList/hooks/useMinimumVisible';
import { StaggeredTabContent } from './StaggeredTabContent';
import { useShoppingListTabsActions } from './ShoppingListTabsActionsContext';
import {
  useShoppingListData,
  useShoppingListSearchQuery,
} from './ShoppingListDataContext';
import { useShoppingListModalActions } from '#features/shoppingList/context/ShoppingListModalsContext';
import { motion } from '#/theme/foundations/motion';

// Module scope so it survives unmount/remount through stack navigation (and
// resets on app restart): once content has shown, skeletons are skipped.
let hasShoppingTabShownContent = false;

const ShoppingTabComponent: React.FC = () => {
  // All data via context, so ShoppingListTabs' renderScene stays data-free.
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
  // Defers the heavy list render past the navigation animation.
  const isReady = useDeferredRender();

  // First FlashList layout commit with rows VISIBLE — data being ready is not
  // that, since FlashList holds every cell at `opacity: 0` through its first
  // layout. A settled EMPTY list never fires it (`hasRealContent` is
  // `items.length > 0`), so every condition below pairs it with a length check.
  const [listPainted, setListPainted] = useState(false);
  const handleFirstContentLayout = () => setListPainted(true);

  // Latch the module flag only once content is really on screen.
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

  // First data load only. The minimum-visible latch below keeps a cache-warm
  // load from flashing them for a sub-perceptible frame.
  const rawShowSkeletons =
    !hasShoppingTabShownContent &&
    (!isReady ||
      isTransitioning ||
      !!loading ||
      (items.length > 0 && !listPainted));
  const showSkeletons = useMinimumVisible(rawShowSkeletons);

  const { t } = useTranslation();
  const searchQuery = useShoppingListSearchQuery();
  const { openAddItemSheet } = useShoppingListModalActions();

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
        onPress: openAddItemSheet,
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
      {/* Always mounted, so the FlashList recycling pool survives. */}
      <View
        style={tabStyles.contentFill}
        pointerEvents={showSkeletons ? 'none' : 'auto'}
      >
        <StaggeredTabContent
          items={items}
          showImages={showImages}
          onItemPress={actions.onItemPress}
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

      {showSkeletons ? (
        <Animated.View
          exiting={FadeOut.duration(motion.timing.STANDARD)}
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
