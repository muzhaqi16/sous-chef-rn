import { useState } from 'react';
import { t } from '#/i18n';
import { alertService } from '#/services/alertService';
import { type ShoppingListItemDisplayFragment } from '#features/shoppingList/graphql/shoppingListFragments.generated';
import { useLazyHomeData } from '#features/home/hooks/useLazyHomeData';
import { useMoveToPantry, type MoveToPantryInput } from './useMoveToPantry';

export interface UseMoveToPantryModalOptions {
  currentListId: string | undefined;
  items: ShoppingListItemDisplayFragment[];
}

export interface UseMoveToPantryModalResult {
  visible: boolean;
  /** Cache key for the modal's `useFragment`, not the item itself. */
  selectedItemId: string | null;
  pantries: Array<{ id: string; name: string; isDefault: boolean }>;
  selectedPantryId: string | null;
  isLoading: boolean;
  /** Lazy-loads the pantry list on first open. */
  openForItem: (itemId: string) => Promise<void>;
  close: () => void;
  confirm: (input: MoveToPantryInput) => Promise<void>;
}

/**
 * The modal materializes the item from the Apollo cache via `useFragment`, so
 * only its id is held here and mutations to it are reflected live.
 */
export function useMoveToPantryModal(
  options: UseMoveToPantryModalOptions,
): UseMoveToPantryModalResult {
  const { currentListId, items } = options;

  const [visible, setVisible] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const {
    pantries,
    selectedPantryId,
    isLoaded: homeDataLoaded,
    fetchHomeData,
    loading: homeLoading,
  } = useLazyHomeData();

  const { moveToPantry, loading: moveLoading } = useMoveToPantry({
    currentListId,
    onSuccess: () => {
      setVisible(false);
      setSelectedItemId(null);
    },
  });

  const openForItem = async (itemId: string) => {
    if (!homeDataLoaded) {
      await fetchHomeData();
    }

    // `pantries` and `homeDataLoaded` are this render's values: the awaited fetch
    // populates them on the next render, so the alert lands on the second open.
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
    // `moveToPantry` needs the item itself: it reads `purchaseInfo` to pick which
    // filtered connection variant to remove the edge from.
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
  };
}
