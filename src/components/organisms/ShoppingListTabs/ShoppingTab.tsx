import React from 'react';
import { SortableShoppingList } from '../SortableShoppingList';
import type { SortableShoppingListItem } from '../SortableShoppingList';

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
  ) => Promise<void>;
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
  disabled?: boolean;
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
  disabled,
  onSwipeableWillOpen,
  onSwipeableClose,
  onDragBegin,
  onDragRelease,
}) => {
  return (
    <SortableShoppingList
      items={items}
      onItemPress={onItemPress}
      onItemEdit={onItemEdit}
      onItemDelete={onItemDelete}
      onTogglePurchase={onTogglePurchase}
      onSortOrderUpdate={onSortOrderUpdate}
      disabled={disabled}
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
