import { useState } from 'react';
import { t } from '#/i18n';
import { alertService } from '#/services/alertService';
import type { ShoppingListItemDisplayFragment } from '#features/shoppingList/graphql/shoppingListFragments.generated';
import { useLazyHomeData } from '#features/home/hooks/useLazyHomeData';
import { useSelectedHomeId } from '#store/useAppStore';
import {
  initialMoveTarget,
  moveTargets,
  type MoveTarget,
} from '#features/shoppingList/utils/moveTargets';
import { useMoveToPantry, type MoveToPantryInput } from './useMoveToPantry';

export interface UseMoveToPantryModalOptions {
  currentListId: string | undefined;
  items: ShoppingListItemDisplayFragment[];
}

export interface UseMoveToPantryModalResult {
  visible: boolean;
  /** Cache key for the modal's `useFragment`, not the item itself. */
  selectedItemId: string | null;
  pantries: readonly MoveTarget[];
  selectedPantryId: string | null;
  /** Lazy-loads the pantry list on first open. */
  openForItem: (itemId: string) => Promise<void>;
  close: () => void;
  /** Resolves true once the move is applied or queued. */
  confirm: (input: MoveToPantryInput) => Promise<boolean>;
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
    homes,
    selectedPantryId: globalPantryId,
    isLoaded: homeDataLoaded,
    fetchHomeData,
  } = useLazyHomeData();
  const selectedHomeId = useSelectedHomeId();

  const targets = moveTargets(homes, selectedHomeId);
  const pantries = targets.status === 'ready' ? targets.pantries : [];
  const selectedPantryId = initialMoveTarget(pantries, globalPantryId ?? null);

  const { moveToPantry } = useMoveToPantry({
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

    // `targets` and `homeDataLoaded` are this render's values: the awaited fetch
    // populates them on the next render, so the alert lands on the second open.
    if (homeDataLoaded && targets.status === 'noPantry') {
      alertService.alert(
        t('moveToPantry.noPantryTitle'),
        t('moveToPantry.noPantryBody'),
        [{ text: t('labels.ok') }],
      );
      return;
    }
    if (homeDataLoaded && targets.status === 'notAllowed') {
      alertService.alert(
        t('moveToPantry.cannotAddTitle'),
        t('moveToPantry.cannotAddBody', { home: targets.homeName }),
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
    if (!selectedItemId) return false;
    // `moveToPantry` needs the item itself: it reads `purchaseInfo` to pick which
    // filtered connection variant to remove the edge from.
    const item = items.find(i => i.id === selectedItemId);
    if (!item) return false;
    return moveToPantry(item, input);
  };

  return {
    visible,
    selectedItemId,
    pantries,
    selectedPantryId,
    openForItem,
    close,
    confirm,
  };
}
