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
  title: 'Add to Pantry',
  testIDPrefix: 'add-pantry-item',
  placeholderIcon: 'cube-outline',
  searchPlaceholder: 'Search or scan item...',
  suggestionGroups: [
    {
      key: 'lowStock',
      title: 'LOW STOCK',
      priority: 1,
      accessor: g => g.lowStock ?? [],
    },
    {
      key: 'expiringSoon',
      title: 'EXPIRING SOON',
      priority: 2,
      accessor: g => g.expiringSoon ?? [],
    },
    {
      key: 'recentlyDeleted',
      title: 'ADD AGAIN',
      priority: 3,
      accessor: g => g.recentlyDeleted ?? [],
    },
    {
      key: 'frequentlyAdded',
      title: 'YOUR FAVORITES',
      priority: 4,
      accessor: g => g.frequentlyAdded ?? [],
    },
    {
      key: 'popular',
      title: 'POPULAR',
      priority: 5,
      accessor: g => g.popular ?? [],
    },
  ],
  quickAdd: {
    fireAndForget: true,
    enableExitAnimations: true,
    toastMessage: (name: string) => `Added ${name}`,
  },
  addDetails: {
    enabled: true,
  },
  deferFetch: true,
  barcodeSource: 'pantry',
  addManuallyPosition: 'top',
  emptyStateMessage: 'No suggestions yet',
  emptyStateSubtext: 'Add items to your pantry to get personalized suggestions',
};
