import React, { useState, useRef } from 'react';
import { useTranslation } from '#/i18n';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import {
  usePantryItemSuggestions,
  PANTRY_SUGGESTIONS_LIMIT,
  type PantryItemSuggestion,
} from '#features/pantry/hooks/usePantryItemSuggestions';
import { useAddToPantry } from '#features/pantry/hooks/mutations/useAddToPantry';
import { toastService } from '#/services/toastService';
import {
  SuggestionSurface,
  type ItemSuggestion,
  type StorageLocation,
} from '#/graphql/generated/schemaTypes';
import { useSuggestionDismissal } from '#features/catalog/hooks/useSuggestionDismissal';
import { AddItemSheet } from '#features/catalog/ui/AddItemSheet/AddItemSheet';
import { useAddItemSheetState } from '#features/catalog/ui/AddItemSheet/useAddItemSheetState';
import type { SuggestionsHookResult } from '#features/catalog/ui/AddItemSheet/types';
import { pantrySheetConfig } from '#features/pantry/components/modals/AddToPantrySheet/pantrySheetConfig';
import { AddDetailsSheet } from './AddDetailsSheet';

interface AddToPantrySheetProps {
  visible: boolean;
  pantryId: string | undefined;
  onClose: () => void;
  onItemAdded?: () => void;
  initialSearchQuery?: string;
}

export const AddToPantrySheet: React.FC<AddToPantrySheetProps> = ({
  visible,
  pantryId,
  onClose,
  onItemAdded,
  initialSearchQuery = '',
}) => {
  const { t } = useTranslation();
  const { toBarcode } = useAppNavigation();

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
  // toast, the exit animation and the in-flight set.
  const {
    addItem,
    restockItem,
    removeSuggestion,
    readStorageLocations,
    findCachedDuplicate,
  } = useAddToPantry({ pantryId, suggestionsLimit: PANTRY_SUGGESTIONS_LIMIT });

  // Fetch pantry item suggestions
  const suggestionsResult = usePantryItemSuggestions({
    pantryId,
    limit: PANTRY_SUGGESTIONS_LIMIT,
    skip: !visible || !state.shouldFetch,
  });

  // Adapt suggestions to the expected interface
  const suggestions: SuggestionsHookResult<PantryItemSuggestion> = {
    grouped: suggestionsResult.grouped,
    loading: suggestionsResult.loading,
    hasSuggestions: suggestionsResult.hasSuggestions,
    refetch: suggestionsResult.refetch,
  };

  // Dismiss a junk/unwanted suggestion from the PANTRY surface.
  const { dismissSuggestion } = useSuggestionDismissal(
    SuggestionSurface.Pantry,
    suggestionsResult.refetch,
  );

  // Storage locations read on-demand from cache (no active watcher)
  const [storageLocations, setStorageLocations] = useState<StorageLocation[]>(
    [],
  );

  // Track items currently being added to prevent duplicate rapid-fire mutations
  const pendingItemIds = useRef(new Set<string>());

  // Keep the sheet "open" across the barcode / identify navigation so the
  // user lands back on it if they cancel. useStandardBottomSheet dismisses the
  // underlying BottomSheetModal when the screen blurs but preserves `visible`,
  // so its focus effect re-presents the sheet (with the user's typed state) on
  // return.
  const handleScanPress = () => {
    toBarcode({
      source: 'pantry',
      pantryId,
    });
  };

  // Prep the details form's inputs when "Add manually" is pressed. The shared
  // AddItemSheet morphs to the in-place details step itself (see renderDetails);
  // here we only seed the prefilled name and the storage locations it reads.
  const handleAddManually = (searchValue: string) => {
    setStorageLocations(readStorageLocations());
    setPrefilledItemName(searchValue);
  };

  /**
   * Restock the row this pantry already stocks instead of creating a second
   * one. The toast fires ahead of the result and is corrected on refusal — a
   * queued restock has no result to wait for.
   */
  const runRestock = async (
    pantryItemId: string,
    name: string,
    cachedQuantity: number | null,
  ) => {
    toastService.success(t('addToPantry.restocked', { name }));
    const outcome = await restockItem(pantryItemId, cachedQuantity);
    if (outcome.status === 'rejected') {
      toastService.error(t('addToPantry.restockFailed'));
      return;
    }
    onItemAdded?.();
  };

  // Quick add from an autocomplete search suggestion. On a duplicate the row is
  // restocked by 1 instead.
  const handleQuickAddSearchSuggestion = async (item: ItemSuggestion) => {
    if (!pantryId || pendingItemIds.current.has(item.id)) return;
    pendingItemIds.current.add(item.id);

    // Offline-first: the pantry answers "do I already stock this?" itself. The
    // server would refuse the create anyway, and offline it never gets asked —
    // so route to the restock now rather than queueing a doomed create.
    const cachedDuplicate = findCachedDuplicate(item.id);
    if (cachedDuplicate) {
      removeSuggestion(item.id);
      await runRestock(
        cachedDuplicate.existingPantryItemId,
        item.name,
        cachedDuplicate.quantity,
      );
      pendingItemIds.current.delete(item.id);
      return;
    }

    toastService.success(
      t(pantrySheetConfig.quickAdd.toastMessageKey, { name: item.name }),
    );
    removeSuggestion(item.id);

    const outcome = await addItem(item.id, item.name);
    if (outcome.status === 'duplicate') {
      // Backstop for what the local check could not see — a windowed list, or a
      // collaborator's add.
      await runRestock(outcome.existingPantryItemId, item.name, null);
      pendingItemIds.current.delete(item.id);
      return;
    }
    pendingItemIds.current.delete(item.id);
    if (outcome.status === 'rejected') {
      // The success toast has already fired; correct it.
      toastService.error(t('errors.addItemFailedRetry'));
      return;
    }
    onItemAdded?.();
  };

  // Quick add from a pantry suggestion tile, which animates out as it goes.
  const handleQuickAddSuggestion = async (pantryItem: PantryItemSuggestion) => {
    if (
      !pantryId ||
      state.exitingItems.has(pantryItem.itemId) ||
      pendingItemIds.current.has(pantryItem.itemId)
    )
      return;
    pendingItemIds.current.add(pantryItem.itemId);
    state.startExitAnimation(pantryItem.itemId);

    // Same local-first check as the search handler above.
    const cachedDuplicate = findCachedDuplicate(pantryItem.itemId);
    if (cachedDuplicate) {
      await runRestock(
        cachedDuplicate.existingPantryItemId,
        pantryItem.name,
        cachedDuplicate.quantity,
      );
      pendingItemIds.current.delete(pantryItem.itemId);
      return;
    }

    toastService.success(
      t(pantrySheetConfig.quickAdd.toastMessageKey, { name: pantryItem.name }),
    );

    const outcome = await addItem(pantryItem.itemId, pantryItem.name);
    if (outcome.status === 'duplicate') {
      await runRestock(outcome.existingPantryItemId, pantryItem.name, null);
      pendingItemIds.current.delete(pantryItem.itemId);
      return;
    }
    pendingItemIds.current.delete(pantryItem.itemId);
    if (outcome.status === 'rejected') {
      // Put the tile back and correct the toast that already fired.
      state.completeExitAnimation(pantryItem.itemId);
      toastService.error(t('errors.addItemFailed'));
      return;
    }
    onItemAdded?.();
  };

  const handleExitComplete = (itemId: string) => {
    removeSuggestion(itemId);
    state.completeExitAnimation(itemId);
  };

  // Dismiss a suggestion: animate it out (cache removal happens on exit
  // complete, shared with quick-add) and persist the dismissal server-side.
  const handleDismissSuggestion = (item: PantryItemSuggestion) => {
    if (state.exitingItems.has(item.itemId)) return;
    state.startExitAnimation(item.itemId);
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
      suggestions={suggestions}
      onQuickAddSearchSuggestion={handleQuickAddSearchSuggestion}
      onQuickAddSuggestion={handleQuickAddSuggestion}
      onDismissSuggestion={handleDismissSuggestion}
      isMutating={false}
      onAddManually={handleAddManually}
      onScanPress={handleScanPress}
      exitingItems={state.exitingItems}
      onExitComplete={handleExitComplete}
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
