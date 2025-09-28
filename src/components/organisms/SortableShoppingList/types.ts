import type { ReactNode } from 'react';
import type { FlatListProps } from 'react-native';

// Legacy types (kept for utils compatibility)
export type Positions = Record<number, number>;
export interface GroupBoundary {
  startIndex: number;
  endIndex: number;
  startY: number;
  endY: number;
}

// Shopping list item interface for sorting
export interface SortableShoppingListItem {
  id: string;
  title: string;
  subtitle: string;
  sortOrder: number;
  isPurchased?: boolean;
  badge?: {
    text: string;
    variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  };
  rightElement?: ReactNode;
  leftElement?: ReactNode;
}

// Props for the main sortable list component
export interface SortableShoppingListProps extends Omit<FlatListProps<SortableShoppingListItem>, 'data' | 'renderItem' | 'keyExtractor'> {
  items: SortableShoppingListItem[];
  onItemPress: (id: string) => void;
  onItemEdit?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  onDragEnd?: (reorderedItems: SortableShoppingListItem[]) => void;
  onSortOrderUpdate?: (updates: SortOrderUpdate[]) => Promise<void>;
  itemHeight?: number;
  disabled?: boolean;
  groupByPurchased?: boolean;
}

// Sort order update for API calls
export interface SortOrderUpdate {
  id: string;
  sortOrder: number;
}

