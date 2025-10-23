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
  leftElement?: ReactNode;
}

// Props for the main sortable list component
export interface SortableShoppingListProps extends Omit<ScrollViewProps, 'data' | 'renderItem' | 'keyExtractor'> {
  items: SortableShoppingListItem[];
  onItemPress: (id: string) => void;
  onItemEdit?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  onTogglePurchase?: (id: string) => void;
  onDragEnd?: (reorderedItems: SortableShoppingListItem[]) => void;
  onSortOrderUpdate?: (itemId: string, afterItemId: string | null, beforeItemId: string | null) => Promise<void>;
  itemHeight?: number;
  disabled?: boolean;
  groupByPurchased?: boolean;
  ListFooterComponent?: ReactElement<unknown, string | JSXElementConstructor<any>> | ComponentType<any> | null;
}

// Sort order update for API calls
export interface SortOrderUpdate {
  id: string;
  sortOrder: string; // Changed from number to string for fractional indexing
}

