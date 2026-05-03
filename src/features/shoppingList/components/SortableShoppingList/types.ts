import type {
  ReactNode,
  ComponentType,
  ReactElement,
  JSXElementConstructor,
} from 'react';
import type { ScrollViewProps } from 'react-native';

// Positions type for drag-and-drop animation
export type Positions = Record<number, number>;

// Legacy types (kept for utils compatibility)
export interface GroupBoundary {
  startIndex: number;
  endIndex: number;
  startY: number;
  endY: number;
}

// Configuration for quantity element (tappable badge instead of counter)
// Opens a bottom sheet for editing quantity and unit when tapped
export interface QuantityElementConfig {
  type: 'quantity';
  quantity: number;
  quantityInput?: string | null;
  unit?: string;
  itemId: string;
  disabled: boolean;
}

// Configuration for image element (avoids creating React elements in useMemo)
export interface ImageElementConfig {
  type: 'image';
  url: string;
  isPurchased?: boolean;
}

// Shopping list item interface for sorting
export interface SortableShoppingListItem {
  id: string;
  title: string;
  subtitle: string | ReactNode;
  sortOrder: string; // Changed from number to string for fractional indexing
  isPurchased?: boolean;
  badge?: {
    text: string;
    variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  };
  rightElement?: ReactNode;
  rightElementConfig?: QuantityElementConfig; // Config-based element creation (performance)
  leftElement?: ReactNode;
  leftElementConfig?: ImageElementConfig; // Config-based element creation (performance)
}

// Props for the main sortable list component
export interface SortableShoppingListProps
  extends Omit<ScrollViewProps, 'data' | 'renderItem' | 'keyExtractor'> {
  items: SortableShoppingListItem[];
  onItemPress: (id: string) => void;
  onItemEdit?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  onTogglePurchase?: (id: string) => void;
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
  ListFooterComponent?:
    | ReactElement<unknown, string | JSXElementConstructor<any>>
    | ComponentType<any>
    | null;
  onSwipeableWillOpen?: (ref: any) => void;
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
  ListEmptyComponent?: ReactElement | ComponentType<any> | null;
}

// Sort order update for API calls
export interface SortOrderUpdate {
  id: string;
  sortOrder: string; // Changed from number to string for fractional indexing
}
