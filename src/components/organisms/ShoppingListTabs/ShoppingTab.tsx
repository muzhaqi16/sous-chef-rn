import React from 'react';
import { SortableShoppingList } from '../SortableShoppingList';
import type { SortableShoppingListItem } from '../SortableShoppingList';
import { LoadingInline } from '#components/base/Loading';

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

export const ShoppingTab: React.FC<ShoppingTabProps> = React.memo(({
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
  // Show loading placeholder when switching lists (loading with no cached items)
  if (loading && items.length === 0) {
    return <LoadingInline message="Loading items..." />;
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
});

ShoppingTab.displayName = 'ShoppingTab';
