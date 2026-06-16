import type { ShoppingListSuggestionItem } from '#features/shoppingList/hooks/useShoppingListSuggestions';
import type { AddItemSheetConfig } from '../types';

/**
 * Configuration for AddToShoppingListSheet.
 *
 * Features:
 * - 3 suggestion groups (Add Again, Favorites, Popular)
 * - Fire-and-forget quick add with exit animations
 * - Deferred fetch for smooth sheet animation
 * - No add details sub-sheet (navigates to separate screen)
 */
export const shoppingListSheetConfig: AddItemSheetConfig<ShoppingListSuggestionItem> =
  {
    title: 'Add to Shopping List',
    testIDPrefix: 'add-shopping-item',
    placeholderIcon: 'cart-outline',
    searchPlaceholder: 'Search or scan item...',
    suggestionGroups: [
      {
        key: 'recentlyDeleted',
        title: 'ADD AGAIN',
        priority: 1,
        accessor: g => g.recentlyDeleted ?? [],
        dismissible: true,
      },
      {
        key: 'frequentlyAdded',
        title: 'YOUR FAVORITES',
        priority: 2,
        accessor: g => g.frequentlyAdded ?? [],
        dismissible: true,
      },
      {
        key: 'popular',
        title: 'POPULAR',
        priority: 3,
        accessor: g => g.popular ?? [],
        dismissible: true,
      },
    ],
    quickAdd: {
      fireAndForget: true,
      enableExitAnimations: true,
      toastMessage: (name: string) => `Added ${name}`,
    },
    addDetails: {
      enabled: false,
    },
    deferFetch: true,
    barcodeSource: 'shoppingList',
    addManuallyPosition: 'bottom',
    emptyStateMessage: 'No suggestions yet',
    emptyStateSubtext:
      "Add items to your list and they'll appear here for quick re-adding",
  };
