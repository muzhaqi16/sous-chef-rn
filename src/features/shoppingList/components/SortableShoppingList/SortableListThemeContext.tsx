import { createContext, useContext } from 'react';

/**
 * Theme colors needed for shopping list items
 * Extracted once at list level, shared via context to all items
 */
export interface SortableListThemeColors {
  primary: string;
  textPrimary: string;
  textSecondary: string;
  surfaceVariant: string;
  surface: string;
  border: string;
  screenWidth: number;
}

export const SortableListThemeContext =
  createContext<SortableListThemeColors | null>(null);

/**
 * Hook to get theme colors from context
 * Falls back to null if used outside provider (allows fallback to useUnistyles)
 */
export const useSortableListTheme = (): SortableListThemeColors | null => {
  return useContext(SortableListThemeContext);
};

/**
 * List-level row display options. Cell components read these via context
 * so a single subscription at list level fans out without re-rendering
 * every row when the value is stable.
 */
export interface ShoppingListRowOptions {
  /** Whether to show product images in row cells */
  showImages: boolean;
}

export const ShoppingListRowOptionsContext =
  createContext<ShoppingListRowOptions>({
    showImages: true,
  });

export const useShoppingListRowOptions = (): ShoppingListRowOptions =>
  useContext(ShoppingListRowOptionsContext);
