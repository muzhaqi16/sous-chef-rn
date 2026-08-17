import type { PantryItemSuggestion } from '#features/pantry/hooks/usePantryItemSuggestions';
import type { AddItemSheetConfig } from '../types';

/**
 * Configuration for AddToPantrySheet.
 *
 * Features:
 * - 5 suggestion groups (Low Stock, Expiring Soon, Add Again, Favorites, Popular)
 * - Fire-and-forget quick add with exit animations
 * - Add Details sub-sheet support
 * - Deferred fetch for smooth sheet animation
 */
export const pantrySheetConfig: AddItemSheetConfig<PantryItemSuggestion> = {
  titleKey: 'addItemSheet.addToPantry',
  testIDPrefix: 'add-pantry-item',
  placeholderIcon: 'cube-outline',
  searchPlaceholderKey: 'addItemSheet.searchPlaceholder',
  suggestionGroups: [
    {
      key: 'lowStock',
      titleKey: 'addItemSheet.sections.lowStock',
      priority: 1,
      accessor: g => g.lowStock ?? [],
    },
    {
      key: 'expiringSoon',
      titleKey: 'addItemSheet.sections.expiringSoon',
      priority: 2,
      accessor: g => g.expiringSoon ?? [],
    },
    {
      key: 'recentlyDeleted',
      titleKey: 'addItemSheet.sections.addAgain',
      priority: 3,
      accessor: g => g.recentlyDeleted ?? [],
      dismissible: true,
    },
    {
      key: 'frequentlyAdded',
      titleKey: 'addItemSheet.sections.favorites',
      priority: 4,
      accessor: g => g.frequentlyAdded ?? [],
      dismissible: true,
    },
    {
      key: 'popular',
      titleKey: 'addItemSheet.sections.popular',
      priority: 5,
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
    enabled: true,
  },
  deferFetch: true,
  barcodeSource: 'pantry',
  addManuallyPosition: 'top',
  emptyStateMessageKey: 'addItemSheet.emptyTitle',
  emptyStateSubtextKey: 'addItemSheet.emptyPantrySubtext',
};
