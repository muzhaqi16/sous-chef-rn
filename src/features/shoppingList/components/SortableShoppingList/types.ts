import type { ReactElement } from 'react';
import type { ScrollViewProps } from 'react-native';
import type { FlashListProps } from '@shopify/flash-list';
import type { FragmentType } from '@apollo/client/masking';
import type { SortableItem_ItemFragmentDoc } from './SortableItem.generated';
import type {
  SwipeableRef,
  SwipeAction,
} from '#/components/molecules/SwipeableItem/types';

export type Positions = Record<number, number>;

export interface GroupBoundary {
  startIndex: number;
  endIndex: number;
  startY: number;
  endY: number;
}

/**
 * Row wrapper for the shopping-list FlashList: only the primitives the list
 * itself needs, plus a masked ref the row unwraps with
 * `useFragment(SortableItem_item)` to subscribe to its cache record.
 */
export interface ShoppingListRowItem {
  id: string;
  /** Forced to match the active tab, so the cell is correct before the toggle
   * propagates through the cache. */
  isPurchased: boolean;
  sortOrder: string | null;
  itemRef: FragmentType<typeof SortableItem_ItemFragmentDoc>;
}

export interface SortableShoppingListProps
  extends Omit<ScrollViewProps, 'data' | 'renderItem' | 'keyExtractor'> {
  items: ShoppingListRowItem[];
  onItemPress: (id: string) => void;
  /** Swipe actions for one row, published via `ItemSwipeActionsProvider`. */
  itemSwipeActions?: (id: string) =>
    | {
        left?: SwipeAction[];
        right?: SwipeAction[];
      }
    | undefined;
  onTogglePurchase?: (id: string, opts?: { withDetails?: boolean }) => void;
  onMoveToPantry?: (id: string) => void;
  onQuantityPress?: (id: string) => void; // Opens quantity edit sheet
  /** Drag-to-reorder. The neighbour ids are null at the ends of the list. */
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
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
  canRemoveItems?: boolean;
  canEditItems?: boolean;
  canMarkPurchased?: boolean;
  /** Drag-to-reorder is offered on unpurchased items only. */
  canReorderItems?: boolean;
  ListEmptyComponent?: FlashListProps<ShoppingListRowItem>['ListEmptyComponent'];
  /** Defaults to true. Threaded through context to keep one list-level
   * subscription on the user preference. */
  showImages?: boolean;
  /**
   * Once per mount, on the first FlashList layout commit with rows present —
   * the earliest frame cells are visible (FlashList holds them at `opacity: 0`
   * until then). The skeleton overlay releases on this, not on data arriving.
   */
  onFirstContentLayout?: () => void;
}

export interface SortOrderUpdate {
  id: string;
  sortOrder: string; // fractional index
}
