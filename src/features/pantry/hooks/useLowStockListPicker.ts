import { useState } from 'react';
import { useCreateShoppingList } from '#features/shoppingList/hooks/useCreateShoppingList';
import { toastService } from '#/services/toastService';
import { errorService } from '#/services/errorService';
import { t } from '#/i18n';
import type { AddToListOutcome } from '#features/pantry/hooks/useAddPantryItemToShoppingList';

/** One low-stock row, in the shape `addToList` needs. */
export interface LowStockAddition {
  itemId: string;
  display: { itemName: string; unitId?: string };
}

type AddToList = (
  shoppingListId: string | null | undefined,
  itemId: string,
  display: { itemName: string; unitId?: string },
) => Promise<AddToListOutcome>;

/** What the picker will add once a list is chosen. */
type PickerTarget = { kind: 'all' } | { kind: 'row'; row: LowStockAddition };

interface Options {
  addToList: AddToList;
  /** The rows on screen. The button adds what the person is looking at. */
  rows: () => LowStockAddition[];
  homeId: string | undefined;
}

/**
 * Adds low-stock rows to a shopping list the person picks, one queued create
 * per row, so the whole thing works offline — `addToList` is already
 * local-first. Replaces `addLowStockItemsToShoppingList`, which asked the
 * server to choose both the rows and the list.
 */
export function useLowStockListPicker({ addToList, rows, homeId }: Options) {
  // One state, not a visible flag beside a pending row: the two were only ever
  // set together, and `null` says "closed" without a second way to disagree.
  const [target, setTarget] = useState<PickerTarget | null>(null);
  const [busy, setBusy] = useState(false);

  const { createShoppingList } = useCreateShoppingList(
    t('errors.createShoppingListFailed'),
  );

  const openForAll = () => setTarget({ kind: 'all' });

  const openForRow = (row: LowStockAddition) => setTarget({ kind: 'row', row });

  const addTo = async (listId: string, picked: PickerTarget) => {
    const targets = picked.kind === 'row' ? [picked.row] : rows();
    if (targets.length === 0) return;

    setBusy(true);
    let kept = 0;
    for (const row of targets) {
      const outcome = await addToList(listId, row.itemId, row.display);
      if (outcome === 'kept') kept += 1;
    }
    setBusy(false);

    if (kept === 0) {
      toastService.error(t('filteredPantry.addToShoppingFailed'));
      return;
    }
    toastService.success(t('toasts.addedItems', { count: kept }));
  };

  const handleListSelected = (listId: string) => {
    const picked = target;
    setTarget(null);
    if (picked) void addTo(listId, picked);
  };

  const handleCreateListAndAdd = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      toastService.error(t('errors.listNameEmpty'));
      return;
    }
    const picked = target;
    setTarget(null);
    if (!picked) return;

    void (async () => {
      setBusy(true);
      // Mints the id, writes the list optimistically and fires local-first, so
      // offline the rows below have a list to name before the server has one.
      let created;
      try {
        created = await createShoppingList({ name: trimmed, homeId });
      } catch (error) {
        errorService.reportError(error, { operation: 'Create list and add' });
      }
      setBusy(false);
      if (!created) {
        toastService.error(t('errors.createShoppingListFailed'));
        return;
      }
      await addTo(created.id, picked);
    })();
  };

  return {
    pickerVisible: target !== null,
    busy,
    openForAll,
    openForRow,
    handleListSelected,
    handleCreateListAndAdd,
    dismissPicker: () => setTarget(null),
  };
}
