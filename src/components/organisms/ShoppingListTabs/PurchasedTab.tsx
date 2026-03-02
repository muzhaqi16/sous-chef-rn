import React, { useEffect } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import Animated, { FadeOut } from 'react-native-reanimated';
import { TIMING } from '#constants/animations';
import type { SortableShoppingListItem } from '../SortableShoppingList/types';
import { SkeletonList } from '#components/base/Skeleton/SkeletonList';
import { ShoppingListItemSkeleton } from '#components/base/Skeleton/ShoppingListItemSkeleton';
import { EmptyState } from '#components/base/EmptyState';
import { useDeferredRender } from '#hooks/performance/useDeferredRender';
import { StaggeredEntryProvider } from '#context/StaggeredEntryContext';
import { StaggeredTabContent } from './StaggeredTabContent';
import { useShoppingListTabsActions } from './ShoppingListTabsActionsContext';

// Module-level flag: once purchased tab content has been shown, skip skeletons on remount.
// Persists across component unmount/remount (stack navigation), resets on app restart.
let hasPurchasedTabShownContent = false;

interface PurchasedTabProps {
  items: SortableShoppingListItem[];
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
  loading?: boolean;
  disabled?: boolean;
  // Pagination props
  onEndReached?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  // Permission flags
  canRemoveItems?: boolean;
  canEditItems?: boolean;
  canMarkPurchased?: boolean;
  // Transition state for showing skeletons during list switches
  isTransitioning?: boolean;
}

const PurchasedTabComponent: React.FC<PurchasedTabProps> = ({
  items,
  onRefresh,
  refreshing,
  loading,
  disabled,
  onEndReached,
  hasMore,
  isLoadingMore,
  canRemoveItems = true,
  canEditItems = true,
  canMarkPurchased = true,
  isTransitioning = false,
}) => {
  // PERF: Action callbacks from context (not props) so renderScene in
  // ShoppingListTabs doesn't depend on them and stays stable.
  const actions = useShoppingListTabsActions();
  // PERFORMANCE: Defer heavy SortableShoppingList render until after navigation completes
  // This ensures smooth screen transitions by showing skeletons during navigation animation
  const isReady = useDeferredRender();

  // Derive whether content has been shown — no state needed.
  // Module-level flag covers remount; items.length > 0 covers cached data on first mount.
  const hasShownContent = hasPurchasedTabShownContent || items.length > 0;

  // Sync the module-level flag so it persists across unmount/remount.
  useEffect(() => {
    if (hasShownContent) {
      hasPurchasedTabShownContent = true;
    }
  }, [hasShownContent]);

  // Show skeletons only on the very first data load, before content is ready.
  const showSkeletons =
    !hasShownContent && (!isReady || isTransitioning || !!loading);

  // Content to render (empty state or list) — always mounted so FlashList pre-initializes
  const content = items.length === 0 && !showSkeletons ? (
    <EmptyState
      icon="cart-outline"
      title="No purchased items yet"
      description="Check off items as you shop to see them here"
    />
  ) : (
    <StaggeredEntryProvider>
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
      />
    </StaggeredEntryProvider>
  );

  return (
    <View style={tabStyles.container}>
      {/* Content layer — always at full opacity, renders behind skeleton */}
      <View style={tabStyles.contentFill} pointerEvents={showSkeletons ? 'none' : 'auto'}>
        {content}
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
