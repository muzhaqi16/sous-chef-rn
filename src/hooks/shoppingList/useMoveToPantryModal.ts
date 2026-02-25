import { useState, useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import { ShoppingListItemDisplayFragment } from '#generated';
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
  /** Selected item for the modal */
  selectedItem: ShoppingListItemDisplayFragment | null;
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
}

/**
 * Hook to manage MoveToPantryModal state and mutations.
 *
 * Handles:
 * - Modal visibility state
 * - Selected item state
 * - Lazy-loaded pantry data (fetched on first open)
 * - Move mutation with cache updates
 * - Validation (no pantries available)
 *
 * @example
 * ```tsx
 * const moveToPantry = useMoveToPantryModal({
 *   currentListId,
 *   items,
 * });
 *
 * // In render:
 * <MoveToPantryModal
 *   visible={moveToPantry.visible}
 *   shoppingListItem={moveToPantry.selectedItem}
 *   pantries={moveToPantry.pantries}
 *   selectedPantryId={moveToPantry.selectedPantryId}
 *   onClose={moveToPantry.close}
 *   onConfirm={moveToPantry.confirm}
 * />
 * ```
 */
export function useMoveToPantryModal(
  options: UseMoveToPantryModalOptions,
): UseMoveToPantryModalResult {
  const { currentListId, items } = options;

  const [visible, setVisible] = useState(false);
  const [selectedItem, setSelectedItem] =
    useState<ShoppingListItemDisplayFragment | null>(null);

  // Lazy-loaded home/pantry data
  const {
    pantries,
    selectedPantryId,
    isLoaded: homeDataLoaded,
    fetchHomeData,
    loading: homeLoading,
  } = useLazyHomeData();

  // Move to pantry mutation
  const { moveToPantry, loading: moveLoading } = useMoveToPantry({
    currentListId,
    onSuccess: () => {
      setVisible(false);
      setSelectedItem(null);
    },
  });

  const openForItem = useCallback(
    async (itemId: string) => {
      // Fetch home data if not already loaded (lazy load on demand)
      if (!homeDataLoaded) {
        await fetchHomeData();
      }

      // Check pantries after data is loaded
      // Note: pantries will be populated after fetchHomeData completes and component re-renders
      // We check pantries.length here but the actual check happens after the async fetch
      if (pantries.length === 0 && homeDataLoaded) {
        Alert.alert(
          'No Pantry Available',
          'Please create a pantry in your home first.',
          [{ text: 'OK' }],
        );
        return;
      }

      const item = items.find(i => i.id === itemId);
      if (item) {
        setSelectedItem(item as ShoppingListItemDisplayFragment);
        setVisible(true);
      }
    },
    [homeDataLoaded, fetchHomeData, pantries.length, items],
  );

  const close = useCallback(() => {
    setVisible(false);
    setSelectedItem(null);
  }, []);

  const confirm = useCallback(
    async (input: MoveToPantryInput) => {
      if (!selectedItem) return;
      await moveToPantry(selectedItem, input);
    },
    [selectedItem, moveToPantry],
  );

  return useMemo(
    () => ({
      visible,
      selectedItem,
      pantries,
      selectedPantryId: selectedPantryId ?? null,
      isLoading: homeLoading || moveLoading,
      openForItem,
      close,
      confirm,
    }),
    [
      visible,
      selectedItem,
      pantries,
      selectedPantryId,
      homeLoading,
      moveLoading,
      openForItem,
      close,
      confirm,
    ],
  );
}
