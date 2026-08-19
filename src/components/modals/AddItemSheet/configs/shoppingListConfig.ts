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
    titleKey: 'addItemSheet.addToShoppingList',
    testIDPrefix: 'add-shopping-item',
    placeholderIcon: 'cart-outline',
    searchPlaceholderKey: 'addItemSheet.searchPlaceholder',
    suggestionGroups: [
      {
        key: 'recentlyDeleted',
        titleKey: 'addItemSheet.sections.addAgain',
        priority: 1,
        accessor: g => g.recentlyDeleted ?? [],
        dismissible: true,
      },
      {
        key: 'frequentlyAdded',
        titleKey: 'addItemSheet.sections.favorites',
        priority: 2,
        accessor: g => g.frequentlyAdded ?? [],
        dismissible: true,
      },
      {
        key: 'popular',
        titleKey: 'addItemSheet.sections.popular',
        priority: 3,
        accessor: g => g.popular ?? [],
        dismissible: true,
      },
    ],
    quickAdd: {
      fireAndForget: true,
      enableExitAnimations: true,
      toastMessageKey: 'addItemSheet.added',
    },
    addDetails: {
      enabled: false,
    },
    deferFetch: true,
    barcodeSource: 'shoppingList',
    addManuallyPosition: 'bottom',
    emptyStateMessageKey: 'addItemSheet.emptyTitle',
    emptyStateSubtextKey: 'addItemSheet.emptyShoppingListSubtext',
  };
