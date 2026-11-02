import React, { useState, useRef } from 'react';
import { useTranslation } from '#/i18n';
import {
  usePantryItemSuggestions,
  PANTRY_SUGGESTIONS_LIMIT,
  type PantryItemSuggestion,
} from '#features/pantry/hooks/usePantryItemSuggestions';
import { useAddToPantry } from '#features/pantry/hooks/mutations/useAddToPantry';
import { toastService } from '#/services/toastService';
import {
  PantrySuggestionSource,
  SuggestionSurface,
  type ItemSuggestion,
} from '#/graphql/generated/schemaTypes';
import type { StorageLocationOption } from '#features/catalog/hooks/useStorageLocationAutocomplete';
import { useSuggestionDismissal } from '#features/catalog/hooks/useSuggestionDismissal';
import { AddItemSheet } from '#features/catalog/ui/AddItemSheet/AddItemSheet';
import { useAddItemSheetState } from '#features/catalog/ui/AddItemSheet/useAddItemSheetState';
import { pantrySheetConfig } from '#features/pantry/components/modals/AddToPantrySheet/pantrySheetConfig';
import { AddDetailsSheet } from './AddDetailsSheet';

/** The stack a low-stock or expiring row names; an Add Again row's is removed. */
const heldStackOf = (row: PantryItemSuggestion) =>
  row.source === PantrySuggestionSource.LowStock ||
  row.source === PantrySuggestionSource.ExpiringSoon
    ? row.pantryItemId
    : null;

interface AddToPantrySheetProps {
  visible: boolean;
  /** `details` opens on the form, for the + menu's "Add manually". */
  startStep?: 'search' | 'details';
  pantryId: string | undefined;
  onClose: () => void;
  onItemAdded?: () => void;
  /**
   * A restock the server could not size: asks for the amount elsewhere, and
   * says whether it could.
   */
  onRestockNeedsAmount?: (pantryItemId: string, reason: string) => boolean;
  initialSearchQuery?: string;
}

export const AddToPantrySheet: React.FC<AddToPantrySheetProps> = ({
  visible,
  startStep,
  pantryId,
  onClose,
  onItemAdded,
  onRestockNeedsAmount,
  initialSearchQuery = '',
}) => {
  const { t } = useTranslation();

  // Details step state. The shared AddItemSheet owns which step is visible
  // (search vs details); here we only prep the inputs the details form reads.
  const [prefilledItemName, setPrefilledItemName] = useState('');

  // Shared state management
  const state = useAddItemSheetState({
    visible,
    contextId: pantryId,
    deferFetch: pantrySheetConfig.deferFetch,
  });

  // Every cache write and mutation this sheet performs. What stays here is the
  // toast and the in-flight set.
  const {
    addItem,
    restockItem,
    removeSuggestion,
    restoreSuggestion,
    readStorageLocations,
    findCachedDuplicate,
  } = useAddToPantry({ pantryId, suggestionsLimit: PANTRY_SUGGESTIONS_LIMIT });

  // Fetch pantry item suggestions
  const suggestionsResult = usePantryItemSuggestions({
    pantryId,
    limit: PANTRY_SUGGESTIONS_LIMIT,
    skip: !visible || !state.shouldFetch,
  });

  // Dismiss a junk/unwanted suggestion from the PANTRY surface.
  const { dismissSuggestion } = useSuggestionDismissal(
    SuggestionSurface.Pantry,
    pantryId ? { __typename: 'Pantry', id: pantryId } : undefined,
  );

  // Storage locations read on-demand from cache (no active watcher)
  const [storageLocations, setStorageLocations] = useState<
    readonly StorageLocationOption[]
  >([]);

  // Track items currently being added to prevent duplicate rapid-fire mutations
  const pendingItemIds = useRef(new Set<string>());

  // Prep the details form's inputs when "Add manually" is pressed. The shared
  // AddItemSheet morphs to the in-place details step itself (see renderDetails);
  // here we only seed the prefilled name and the storage locations it reads.
  const handleAddManually = (searchValue: string) => {
    setStorageLocations(readStorageLocations());
    setPrefilledItemName(searchValue);
  };

  /**
   * Restock the row this pantry already stocks instead of creating a second
   * one. The toast waits for the outcome, which a queued restock reaches at
   * once: packages the server cannot size open a form, not a success.
   */
  const runRestock = async (
    pantryItemId: string,
    item: { id: string; name: string },
    removal: ReturnType<typeof removeSuggestion>,
  ) => {
    const outcome = await restockItem(pantryItemId, item);
    if (outcome.status === 'rejected') {
      const { sizeRefusal } = outcome;
      if (sizeRefusal && onRestockNeedsAmount?.(pantryItemId, sizeRefusal)) {
        return;
      }
      restoreSuggestion(removal);
      toastService.error(sizeRefusal ?? t('addToPantry.restockFailed'));
      return;
    }
    toastService.success(t('addToPantry.restocked', { name: item.name }));
    onItemAdded?.();
  };

  // Quick add from an autocomplete search suggestion. On a duplicate the row is
  // restocked by 1 instead.
  const handleQuickAddSearchSuggestion = async (item: ItemSuggestion) => {
    if (!pantryId || pendingItemIds.current.has(item.id)) return;
    pendingItemIds.current.add(item.id);
    // Off the suggestion lists at once; a refusal puts back exactly this.
    const removal = removeSuggestion(item.id);

    // Offline-first: the pantry answers "do I already stock this?" itself. The
    // server would refuse the create anyway, and offline it never gets asked —
    // so route to the restock now rather than queueing a doomed create.
    const cachedDuplicate = findCachedDuplicate(item.id, item.defaultUnit?.id);
    if (cachedDuplicate) {
      await runRestock(cachedDuplicate.existingPantryItemId, item, removal);
      pendingItemIds.current.delete(item.id);
      return;
    }

    toastService.success(
      t(pantrySheetConfig.quickAdd.toastMessageKey, { name: item.name }),
    );

    // A stack the local check could not see (a windowed list, a collaborator's
    // add) is joined by the server: the add is forced.
    const outcome = await addItem(item.id, item.name);
    pendingItemIds.current.delete(item.id);
    if (outcome.status === 'rejected') {
      // The success toast has already fired; correct it.
      restoreSuggestion(removal);
      toastService.error(t('errors.addItemFailedRetry'));
      return;
    }
    onItemAdded?.();
  };

  // Quick add from a pantry suggestion tile, which leaves the list at once and
  // animates out as it unmounts.
  const handleQuickAddSuggestion = async (pantryItem: PantryItemSuggestion) => {
    if (!pantryId || pendingItemIds.current.has(pantryItem.itemId)) return;
    pendingItemIds.current.add(pantryItem.itemId);
    const removal = removeSuggestion(pantryItem.itemId);
    const catalogItem = { id: pantryItem.itemId, name: pantryItem.name };

    // Same local-first check as the search handler above.
    const cachedDuplicate = findCachedDuplicate(
      pantryItem.itemId,
      pantryItem.defaultUnitId,
    );
    if (cachedDuplicate) {
      await runRestock(
        cachedDuplicate.existingPantryItemId,
        catalogItem,
        removal,
      );
      pendingItemIds.current.delete(pantryItem.itemId);
      return;
    }

    // Past the loaded window the cache cannot see the stack, but the suggestion
    // names it: restocking it moves that row at once, offline too, where a
    // forced add would show a second row until the server joined them.
    const heldStackId = heldStackOf(pantryItem);
    if (heldStackId) {
      await runRestock(heldStackId, catalogItem, removal);
      pendingItemIds.current.delete(pantryItem.itemId);
      return;
    }

    toastService.success(
      t(pantrySheetConfig.quickAdd.toastMessageKey, { name: pantryItem.name }),
    );

    const outcome = await addItem(pantryItem.itemId, pantryItem.name);
    pendingItemIds.current.delete(pantryItem.itemId);
    if (outcome.status === 'rejected') {
      // Put the tile back and correct the toast that already fired.
      restoreSuggestion(removal);
      toastService.error(t('errors.addItemFailed'));
      return;
    }
    onItemAdded?.();
  };

  const handleDismissSuggestion = (item: PantryItemSuggestion) => {
    dismissSuggestion({ itemId: item.itemId, name: item.name });
  };

  // Item created from the details form — refresh suggestions and close the
  // whole sheet.
  const handleAddSuccess = () => {
    suggestionsResult.refetch();
    toastService.success(t('addToPantry.itemAdded'));
    onItemAdded?.();
    onClose();
  };

  return (
    <AddItemSheet
      visible={visible}
      contextId={pantryId}
      onClose={onClose}
      config={pantrySheetConfig}
      suggestions={suggestionsResult}
      onQuickAddSearchSuggestion={handleQuickAddSearchSuggestion}
      onQuickAddSuggestion={handleQuickAddSuggestion}
      onDismissSuggestion={handleDismissSuggestion}
      onAddManually={handleAddManually}
      startStep={startStep}
      shouldFetch={state.shouldFetch}
      initialSearchQuery={initialSearchQuery}
      renderDetails={({ goBack }) => (
        <AddDetailsSheet
          pantryId={pantryId}
          prefilledItemName={prefilledItemName}
          storageLocations={storageLocations}
          onClose={goBack}
          onSuccess={handleAddSuccess}
        />
      )}
    />
  );
};
