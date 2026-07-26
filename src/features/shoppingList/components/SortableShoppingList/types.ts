import type { ReactElement } from 'react';
import type { ScrollViewProps } from 'react-native';
import type { FlashListProps } from '@shopify/flash-list';
import type { FragmentType } from '@apollo/client/masking';
import type { SortableItem_ItemFragmentDoc } from './SortableItem.generated';
import type { SwipeableRef } from '#/components/molecules/SwipeableItem/types';

// Positions type for drag-and-drop animation
export type Positions = Record<number, number>;

// Legacy types (kept for utils compatibility)
export interface GroupBoundary {
  startIndex: number;
  endIndex: number;
  startY: number;
  endY: number;
}

/**
 * Lightweight row wrapper used by the shopping list FlashList.
 *
 * Carries only the primitives the list itself needs (`id`, `isPurchased`,
 * `sortOrder`) plus the masked `itemRef` fragment ref for the
 * `SortableItem_item` selection. The row component calls `useFragment` on
 * `itemRef` to subscribe to its entity's cache record.
 */
export interface ShoppingListRowItem {
  /** Stable identity for FlashList keyExtractor + tutorial targeting */
  id: string;
  /**
   * Forced isPurchased — matches the active tab so the cell renders the
   * correct visual state even before the cache propagates after a toggle.
   */
  isPurchased: boolean;
  /** Sort order used by the reorder helper / sanity-check chains */
  sortOrder: string | null;
  /** Masked fragment ref the row passes to `useFragment(SortableItem_item)` */
  itemRef: FragmentType<typeof SortableItem_ItemFragmentDoc>;
}

// Props for the main sortable list component
export interface SortableShoppingListProps
  extends Omit<ScrollViewProps, 'data' | 'renderItem' | 'keyExtractor'> {
  items: ShoppingListRowItem[];
  onItemPress: (id: string) => void;
  onItemEdit?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  onTogglePurchase?: (id: string, opts?: { withDetails?: boolean }) => void;
  onMoveToPantry?: (id: string) => void;
  onQuantityPress?: (id: string) => void; // Opens quantity edit sheet
  /**
   * Callback for reordering items via drag-to-reorder
   * @param itemId - ID of the item being moved
   * @param afterItemId - ID of the item that should come before the moved item (null if moving to start)
   * @param beforeItemId - ID of the item that should come after the moved item (null if moving to end)
   */
  onSortOrderUpdate?: (
    itemId: string,
    afterItemId: string | null,
    beforeItemId: string | null,
  ) => void;
  itemHeight?: number;
  disabled?: boolean;
  groupByPurchased?: boolean;
  ListHeaderComponent?: ReactElement | null;
  ListFooterComponent?: FlashListProps<ShoppingListRowItem>['ListFooterComponent'];
  onSwipeableWillOpen?: (ref: SwipeableRef) => void;
  onSwipeableClose?: () => void;
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
  // Pagination props
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
  // Permission flags for conditional rendering of item actions
  canRemoveItems?: boolean;
  canEditItems?: boolean;
  canMarkPurchased?: boolean;
  // Drag-to-reorder permission (only for unpurchased items)
  canReorderItems?: boolean;
  // Empty state component shown when items array is empty
  ListEmptyComponent?: FlashListProps<ShoppingListRowItem>['ListEmptyComponent'];
  /**
   * Whether row cells render their product image. Threaded through context
   * so we keep a single list-level subscription on the user preference.
   * Defaults to true.
   */
  showImages?: boolean;
}

// Sort order update for API calls
export interface SortOrderUpdate {
  id: string;
  sortOrder: string; // Changed from number to string for fractional indexing
}
