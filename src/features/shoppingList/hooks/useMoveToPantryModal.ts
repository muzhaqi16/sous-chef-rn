import { useState } from 'react';
import { t } from '#/i18n';
import { alertService } from '#/services/alertService';
import { type ShoppingListItemDisplayFragment } from '#features/shoppingList/graphql/shoppingListFragments.generated';
import { useLazyHomeData } from '#hooks/home/useLazyHomeData';
import { useMoveToPantry, type MoveToPantryInput } from './useMoveToPantry';

/**
 * Options for useMoveToPantryModal hook
 */
export interface UseMoveToPantryModalOptions {
  /** Current shopping list ID */
  currentListId: string | undefined;
  /** Items array to find item by ID */
  items: ShoppingListItemDisplayFragment[];
}

/**
 * Return value from useMoveToPantryModal hook
 */
export interface UseMoveToPantryModalResult {
  /** Whether the modal is visible */
  visible: boolean;
  /** Selected item id for the modal (cache key for `useFragment`) */
  selectedItemId: string | null;
  /** Available pantries (lazy-loaded) */
  pantries: Array<{ id: string; name: string; isDefault: boolean }>;
  /** Default selected pantry ID */
  selectedPantryId: string | null;
  /** Whether pantry data is loading */
  isLoading: boolean;
  /** Open modal for a specific item (triggers lazy load if needed) */
  openForItem: (itemId: string) => Promise<void>;
  /** Close the modal */
  close: () => void;
  /** Confirm move to pantry */
  confirm: (input: MoveToPantryInput) => Promise<void>;
  /** Server unreachable — the move has no offline replay path, so disable confirm. */
  isApiUnavailable: boolean;
}

/**
 * Hook to manage MoveToPantryModal state and mutations.
 *
 * Handles:
 * - Modal visibility state
 * - Selected item id state — the modal materializes the item from the Apollo
 *   cache via `useFragment` so mutations to the item are reflected live.
 * - Lazy-loaded pantry data (fetched on first open)
 * - Move mutation with cache updates
 * - Validation (no pantries available)
 */
export function useMoveToPantryModal(
  options: UseMoveToPantryModalOptions,
): UseMoveToPantryModalResult {
  const { currentListId, items } = options;

  const [visible, setVisible] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Lazy-loaded home/pantry data
  const {
    pantries,
    selectedPantryId,
    isLoaded: homeDataLoaded,
    fetchHomeData,
    loading: homeLoading,
  } = useLazyHomeData();

  // Move to pantry mutation
  const {
    moveToPantry,
    loading: moveLoading,
    isApiUnavailable,
  } = useMoveToPantry({
    currentListId,
    onSuccess: () => {
      setVisible(false);
      setSelectedItemId(null);
    },
  });

  const openForItem = async (itemId: string) => {
    // Fetch home data if not already loaded (lazy load on demand)
    if (!homeDataLoaded) {
      await fetchHomeData();
    }

    // Check pantries after data is loaded
    // Note: pantries will be populated after fetchHomeData completes and component re-renders
    // We check pantries.length here but the actual check happens after the async fetch
    if (pantries.length === 0 && homeDataLoaded) {
      alertService.alert(
        t('moveToPantry.noPantryTitle'),
        t('moveToPantry.noPantryBody'),
        [{ text: t('labels.ok') }],
      );
      return;
    }

    const item = items.find(i => i.id === itemId);
    if (item) {
      setSelectedItemId(item.id);
      setVisible(true);
    }
  };

  const close = () => {
    setVisible(false);
    setSelectedItemId(null);
  };

  const confirm = async (input: MoveToPantryInput) => {
    if (!selectedItemId) return;
    // `useMoveToPantry.moveToPantry` needs the item for cache update closures
    // (it reads `purchaseInfo` to know which connection-edge filter to remove
    // from). Look it up from the items prop at confirm time.
    const item = items.find(i => i.id === selectedItemId);
    if (!item) return;
    await moveToPantry(item, input);
  };

  return {
    visible,
    selectedItemId,
    pantries,
    selectedPantryId: selectedPantryId ?? null,
    isLoading: homeLoading || moveLoading,
    openForItem,
    close,
    confirm,
    isApiUnavailable,
  };
}
