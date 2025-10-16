import type { ReactNode } from 'react';
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

// Shopping list item interface for sorting
export interface SortableShoppingListItem {
  id: string;
  title: string;
  subtitle: string | ReactNode;
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
export interface SortableShoppingListProps extends Omit<ScrollViewProps, 'data' | 'renderItem' | 'keyExtractor'> {
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

