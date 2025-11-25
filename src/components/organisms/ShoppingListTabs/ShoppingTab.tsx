import React from 'react';
import { ScrollView } from 'react-native';
import { SortableShoppingList } from '../SortableShoppingList';
import type { SortableShoppingListItem } from '../SortableShoppingList';
import { ShoppingListItemSkeleton } from '#components/base/Skeleton/ShoppingListItemSkeleton';
import { useDeferredRender } from '#hooks/performance';

interface ShoppingTabProps {
  items: SortableShoppingListItem[];
  onItemPress: (id: string) => void;
  onItemEdit?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  onTogglePurchase?: (id: string) => void;
  onSortOrderUpdate?: (
    itemId: string,
    afterItemId: string | null,
    beforeItemId: string | null,
    afterSortOrder: string | null,
    beforeSortOrder: string | null,
  ) => Promise<void>;
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
  loading?: boolean;
  disabled?: boolean;
  isDragging?: boolean;
  onSwipeableWillOpen?: (ref: any) => void;
  onSwipeableClose?: () => void;
  onDragBegin?: () => void;
  onDragRelease?: () => void;
}

const ShoppingTabComponent: React.FC<ShoppingTabProps> = ({
  items,
  onItemPress,
  onItemEdit,
  onItemDelete,
  onTogglePurchase,
  onSortOrderUpdate,
  onRefresh,
  refreshing,
  loading,
  disabled,
  isDragging,
  onSwipeableWillOpen,
  onSwipeableClose,
  onDragBegin,
  onDragRelease,
}) => {
  // PERFORMANCE: Defer heavy SortableShoppingList render until after navigation completes
  // This ensures smooth screen transitions by showing skeletons during navigation animation
  // The 150ms delay gives extra buffer after InteractionManager signals completion
  const isReady = useDeferredRender(150);

  // Skeleton-first approach: Show skeletons whenever loading OR during navigation transition
  // This ensures smooth UX when switching between lists and during screen transitions
  if (loading || !isReady) {
    return (
      <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
        {[1, 2, 3, 4, 5].map(key => (
          <ShoppingListItemSkeleton key={key} />
        ))}
      </ScrollView>
    );
  }

  return (
    <SortableShoppingList
      items={items}
      onItemPress={onItemPress}
      onItemEdit={onItemEdit}
      onItemDelete={onItemDelete}
      onTogglePurchase={onTogglePurchase}
      onSortOrderUpdate={onSortOrderUpdate}
      disabled={disabled}
      isDragging={isDragging}
      showsVerticalScrollIndicator={true}
      onSwipeableWillOpen={onSwipeableWillOpen}
      onSwipeableClose={onSwipeableClose}
      onRefresh={onRefresh}
      refreshing={refreshing}
      onDragBegin={onDragBegin}
      onDragRelease={onDragRelease}
    />
  );
};

// PERFORMANCE: Memoize with shallow comparison
export const ShoppingTab = React.memo(ShoppingTabComponent);
ShoppingTab.displayName = 'ShoppingTab';
