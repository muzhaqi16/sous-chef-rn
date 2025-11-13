/**
 * Empty state configurations for shopping list screens
 *
 * These utilities generate consistent empty state objects
 * for different shopping list scenarios.
 */

interface EmptyStateConfig {
  title: string;
  subtitle: string;
  icon?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Empty state for when there are no shopping lists
 */
export const createNoListsEmptyState = (
  onCreateList: () => void,
): EmptyStateConfig => ({
  title: 'No Shopping Lists',
  subtitle: 'Create your first shopping list to get started',
  icon: 'list',
  actionLabel: 'Create List',
  onAction: onCreateList,
});

/**
 * Empty state for when a list has no items
 */
export const createNoItemsEmptyState = (
  onAddItem: () => void,
): EmptyStateConfig => ({
  title: 'Your list is empty',
  subtitle: 'Add items to your shopping list',
  icon: 'add-circle-outline',
  actionLabel: 'Add Item',
  onAction: onAddItem,
});

/**
 * Empty state for when search returns no results
 */
export const createNoSearchResultsEmptyState = (): EmptyStateConfig => ({
  title: 'No results found',
  subtitle: 'Try a different search term',
  icon: 'search',
});

/**
 * Empty state for when list is loading
 */
export const createLoadingEmptyState = (): EmptyStateConfig => ({
  title: 'Loading...',
  subtitle: 'Please wait while we fetch your items',
  icon: 'hourglass-outline',
});
