import type { ReactNode, ComponentType, ReactElement, JSXElementConstructor } from 'react';
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

// Configuration for counter element (avoids creating React elements in useMemo)
// Callbacks are retrieved from ShoppingListActionsContext for stable references
export interface CounterElementConfig {
  type: 'counter';
  quantity: number;
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
  rightElementConfig?: CounterElementConfig; // Config-based element creation (performance)
  leftElement?: ReactNode;
  leftElementConfig?: ImageElementConfig; // Config-based element creation (performance)
}

// Props for the main sortable list component
export interface SortableShoppingListProps extends Omit<ScrollViewProps, 'data' | 'renderItem' | 'keyExtractor'> {
  items: SortableShoppingListItem[];
  onItemPress: (id: string) => void;
  onItemEdit?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  onTogglePurchase?: (id: string) => void;
  onDragEnd?: (reorderedItems: SortableShoppingListItem[]) => void;
  onSortOrderUpdate?: (
    itemId: string,
    afterItemId: string | null,
    beforeItemId: string | null,
    afterSortOrder: string | null,
    beforeSortOrder: string | null,
  ) => Promise<void>;
  itemHeight?: number;
  disabled?: boolean;
  groupByPurchased?: boolean;
  ListFooterComponent?: ReactElement<unknown, string | JSXElementConstructor<any>> | ComponentType<any> | null;
  onSwipeableWillOpen?: (ref: any) => void;
  onSwipeableClose?: () => void;
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
  onDragBegin?: () => void;
  onDragRelease?: () => void;
  isDragging?: boolean;
}

// Sort order update for API calls
export interface SortOrderUpdate {
  id: string;
  sortOrder: string; // Changed from number to string for fractional indexing
}

