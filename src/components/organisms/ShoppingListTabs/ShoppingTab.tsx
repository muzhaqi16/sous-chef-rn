import React, { useEffect, useState } from 'react';
import type { SortableShoppingListItem } from '../SortableShoppingList/types';
import { SkeletonList } from '#components/base/Skeleton/SkeletonList';
import { ShoppingListItemSkeleton } from '#components/base/Skeleton/ShoppingListItemSkeleton';
import { EmptyState } from '#components/base/EmptyState';
import { ShoppingEmptyIllustration } from '#components/base/ShoppingEmptyIllustration';
import { useDeferredRender } from '#hooks/performance/useDeferredRender';
import { StaggeredEntryProvider } from '#context/StaggeredEntryContext';
import { StaggeredTabContent } from './StaggeredTabContent';
import { useShoppingListTabsActions } from './ShoppingListTabsActionsContext';

// Module-level flag: once shopping tab content has been shown, skip skeletons on remount.
// Persists across component unmount/remount (stack navigation), resets on app restart.
let hasShoppingTabShownContent = false;

interface ShoppingTabProps {
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
  canReorderItems?: boolean;
  // Transition state for showing skeletons during list switches
  isTransitioning?: boolean;
}

const ShoppingTabComponent: React.FC<ShoppingTabProps> = ({
  items,
  onRefresh,
  refreshing,
  disabled,
  onEndReached,
  canRemoveItems = true,
  canEditItems = true,
  canMarkPurchased = true,
  canReorderItems = false,
  isTransitioning = false,
}) => {
  // PERF: Action callbacks from context (not props) so renderScene in
  // ShoppingListTabs doesn't depend on them and stays stable.
  const actions = useShoppingListTabsActions();
  // PERFORMANCE: Defer heavy SortableShoppingList render until after navigation completes
  // This ensures smooth screen transitions by showing skeletons during navigation animation
  const isReady = useDeferredRender();

  // Track the module-level flag in state so we can read it during render.
  // Uses React's "adjusting state during render" pattern to stay in sync.
  const [hasShownContent, setHasShownContent] = useState(hasShoppingTabShownContent);

  // Once content has been shown, latch state so skeletons never reappear.
  if (!hasShownContent && isReady && !isTransitioning && items.length > 0) {
    setHasShownContent(true);
  }

  // Sync the module-level flag so it persists across unmount/remount (side effect).
  useEffect(() => {
    if (hasShownContent) {
      hasShoppingTabShownContent = true;
    }
  }, [hasShownContent]);

  // Show skeletons only on the very first data load
  const showSkeletons = !hasShownContent && (!isReady || isTransitioning);
  if (showSkeletons) {
    return <SkeletonList SkeletonComponent={ShoppingListItemSkeleton} />;
  }

  // Empty state for shopping tab
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingEmptyIllustration size="medium" />}
        title="Your list is empty"
        description="Add items to start your shopping list"
      />
    );
  }

  return (
    <StaggeredEntryProvider>
      <StaggeredTabContent
        items={items}
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
        canRemoveItems={canRemoveItems}
        canEditItems={canEditItems}
        canMarkPurchased={canMarkPurchased}
        canReorderItems={canReorderItems}
      />
    </StaggeredEntryProvider>
  );
};

export const ShoppingTab = ShoppingTabComponent;
