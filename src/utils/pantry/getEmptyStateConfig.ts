/**
 * Get empty state configuration for pantry screens
 *
 * Determines the appropriate empty state based on context
 */

interface EmptyStateConfig {
  title: string;
  subtitle: string;
  icon?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Get empty state configuration based on pantry context
 *
 * @param hasHome - Whether user has a selected home
 * @param onNavigateToHome - Navigation handler to home selection
 * @param onAddItem - Handler to add first pantry item
 * @returns Empty state configuration object
 */
export const getEmptyStateConfig = (
  hasHome: boolean,
  onNavigateToHome: () => void,
  onAddItem: () => void,
): EmptyStateConfig => {
  if (!hasHome) {
    return {
      title: 'No Home Selected',
      subtitle: 'Please select a home to view pantry items',
      icon: 'home-outline',
      actionLabel: 'Select Home',
      onAction: onNavigateToHome,
    };
  }

  return {
    title: 'Your pantry is empty',
    subtitle: 'Start adding items to track your pantry inventory',
    icon: 'basket-outline',
    actionLabel: 'Add Item',
    onAction: onAddItem,
  };
};

/**
 * Empty state for expired items
 */
export const getExpiredItemsEmptyState = (): EmptyStateConfig => ({
  title: 'No Expired Items',
  subtitle: 'All your pantry items are fresh!',
  icon: 'checkmark-circle-outline',
});

/**
 * Empty state for low stock items
 */
export const getLowStockEmptyState = (): EmptyStateConfig => ({
  title: 'No Low Stock Items',
  subtitle: 'Your pantry is well stocked!',
  icon: 'checkmark-circle-outline',
});
