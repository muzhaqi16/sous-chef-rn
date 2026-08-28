import React, { useState, useRef } from 'react';
import { useTranslation } from '#/i18n';
import { useApolloClient, useMutation } from '@apollo/client/react';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import {
  usePantryItemSuggestions,
  PANTRY_SUGGESTIONS_LIMIT,
  type PantryItemSuggestion,
} from '#features/pantry/hooks/usePantryItemSuggestions';
import { toastService } from '#/services/toastService';
import {
  CreatePantryItemDocument,
  RestockPantryItemDocument,
  GetPantryDocument,
  type GetPantryQuery,
  GetPantryItemSuggestionsDocument,
  type GetPantryItemSuggestionsQuery,
} from '#features/pantry/graphql/pantry.generated';
import {
  SuggestionSurface,
  type ItemSuggestion,
  type StorageLocation,
} from '#/graphql/generated/schemaTypes';
import { useSuggestionDismissal } from '#features/catalog/hooks/useSuggestionDismissal';
import { extractNodes } from '#/utils/connectionUtils';
import { getPantryItemDuplicateFromResult } from '#/utils/errors/pantryItemDuplicate';
import { addToPantryItemsCache } from '#/apollo/utils/pantryCacheUpdaters';
import { buildOptimisticPantryItem } from '#features/pantry/hooks/buildOptimisticPantryItem';
import { safeEvict, adoptServerEntityId } from '#/apollo/utils/cacheUpdaters';
import { generateEntityId } from '#/utils/generateEntityId';
import { unconfirmedCreates } from '#/apollo/offline/unconfirmedCreates';
import { writePantryItemDetailStub } from '#features/pantry/hooks/writePantryItemDetailStub';
import { AddItemSheet } from '#features/catalog/ui/AddItemSheet/AddItemSheet';
import { useAddItemSheetState } from '#features/catalog/ui/AddItemSheet/useAddItemSheetState';
import type { SuggestionsHookResult } from '#features/catalog/ui/AddItemSheet/types';
import { pantrySheetConfig } from '#features/pantry/components/modals/AddToPantrySheet/pantrySheetConfig';
import { AddDetailsSheet } from './AddDetailsSheet';
import { errorService } from '#/services/errorService';

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
  const client = useApolloClient();

  // Details step state. The shared AddItemSheet owns which step is visible
  // (search vs details); here we only prep the inputs the details form reads.
  const [prefilledItemName, setPrefilledItemName] = useState('');

  // Shared state management
  const state = useAddItemSheetState({
    visible,
    contextId: pantryId,
    deferFetch: pantrySheetConfig.deferFetch,
  });

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

  // Create pantry item mutation — synchronous cache update prevents flickering
  const [createPantryItem] = useMutation(CreatePantryItemDocument, {
    update: (cache, { data }, { variables }) => {
      const payload = data?.createPantryItem;
      if (payload?.__typename !== 'CreatePantryItemPayload' || !pantryId)
        return;
      const pantryItem = payload.pantryItem;
      // Read outside the try: `?.` is a value block, and one inside a try body
      // bails the React Compiler out of the whole component.
      const clientId = variables?.input?.id;

      try {
        addToPantryItemsCache(cache, pantryId, pantryItem);
        // The re-add dedupes BY ID, so a server-resolved id divergence
        // would leave the client cuid as a second, permanently unresolvable
        // edge. Client id read off this mutation's own variables.
        adoptServerEntityId(cache, 'PantryItem', pantryItem.id, clientId);
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Cache update failed for createPantryItem:',
        });
      }
    },
  });

  // Restock pantry item mutation
  const [restockPantryItem] = useMutation(RestockPantryItemDocument, {
    update: (cache, { data }) => {
      const payload = data?.restockPantryItem;
      if (payload?.__typename !== 'RestockPantryItemPayload' || !pantryId) {
        return;
      }
      const pantryItem = payload.pantryItemUsage.pantryItem;
      if (!pantryItem) return;
      // Force connection cache broadcast — the item already exists,
      // so addToPantryItemsCache will detect the duplicate and return
      // the existing connection unchanged, but cache.modify still
      // triggers query watchers to re-emit.
      addToPantryItemsCache(cache, pantryId, pantryItem);
    },
  });

  // Track items currently being added to prevent duplicate rapid-fire mutations
  const pendingItemIds = useRef(new Set<string>());

  // Remove a suggestion from the cache synchronously
  const removeSuggestionFromCache = (itemId: string) => {
    if (!pantryId) return;
    client.cache.updateQuery<GetPantryItemSuggestionsQuery>(
      {
        query: GetPantryItemSuggestionsDocument,
        variables: { pantryId, limit: PANTRY_SUGGESTIONS_LIMIT },
      },
      data => {
        if (!data?.pantry) return data;
        const pantry = data.pantry;
        return {
          ...data,
          pantry: {
            ...pantry,
            lowStock: pantry.lowStock.filter(s => s.itemId !== itemId),
            expiringSoon: pantry.expiringSoon.filter(s => s.itemId !== itemId),
            recentlyDeleted: pantry.recentlyDeleted.filter(
              s => s.itemId !== itemId,
            ),
            frequentlyAdded: pantry.frequentlyAdded.filter(
              s => s.itemId !== itemId,
            ),
            popular: pantry.popular.filter(s => s.itemId !== itemId),
          },
        };
      },
    );
  };

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
    // Read storage locations from Apollo cache (one-shot, no watcher)
    const cached = client.readQuery<GetPantryQuery>({
      query: GetPantryDocument,
      variables: { id: pantryId ?? '' },
    });
    setStorageLocations(
      extractNodes(
        cached?.pantry?.storageLocationsConnection,
      ) as StorageLocation[],
    );
    setPrefilledItemName(searchValue);
  };

  // Handle quick add from autocomplete suggestion (fire-and-forget)
  // On duplicate: auto-restock by 1 silently
  const handleQuickAddSearchSuggestion = (item: ItemSuggestion) => {
    if (!pantryId || pendingItemIds.current.has(item.id)) return;

    const id = generateEntityId();
    // Publishing this id to `Pantry.itemsConnection` below makes the row
    // tappable, and its detail/edit screens query by it. Hold those off until
    // the server has the row — see `unconfirmedCreates`.
    unconfirmedCreates.mark(id);
    const variables = {
      input: {
        id,
        pantryId,
        itemId: item.id,
      },
    };

    // Mark as pending to prevent duplicate rapid-fire adds
    pendingItemIds.current.add(item.id);

    // 1. Show toast immediately
    toastService.success(
      t(pantrySheetConfig.quickAdd.toastMessageKey, { name: item.name }),
    );

    // 2. Remove suggestion from cache immediately
    removeSuggestionFromCache(item.id);

    // 3. Write the item into the cache before firing, so it shows immediately and
    // stays if the create is queued offline (the queue replays it later, keyed by
    // this id).
    try {
      addToPantryItemsCache(
        client.cache,
        pantryId,
        buildOptimisticPantryItem(
          id,
          {
            pantryId,
            itemName: item.name,
            itemId: item.id,
          },
          client.cache,
        ),
      );
      // Detail-shape the same row so tapping it renders from cache instead
      // of querying an id the server does not have yet.
      writePantryItemDetailStub(client.cache, id, {
        itemId: item.id,
        itemName: item.name,
      });
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Add Pantry Item (optimistic)',
      });
    }

    // 4. Fire mutation without await (cache update handled by mutation's update callback)
    createPantryItem({ variables, context: { localFirst: true } })
      .then(result => {
        // The duplicate arrives as a typed DuplicatePantryItemError member in
        // `data` (or the legacy PANTRY_ITEM_ALREADY_EXISTS error); check both,
        // else a duplicate would fall through and leave the phantom optimistic
        // item while reporting a false success.
        const duplicateInfo = getPantryItemDuplicateFromResult(
          result.data?.createPantryItem,
          result.error,
        );
        if (duplicateInfo) {
          // Already in the pantry → the server restocks the existing row, not
          // our optimistic cuid. Evict the phantom optimistic item.
          safeEvict(client.cache, 'PantryItem', id);
          // Auto-restock by 1 for quick-add
          restockPantryItem({
            variables: {
              input: {
                id: duplicateInfo.existingPantryItemId,
                quantity: 1,
                // idempotencyKey dedups the restock ledger row on replay.
                idempotencyKey: generateEntityId(),
              },
            },
            // Local-first: queued offline, replayed as the canonical mutation
            // (deduped by its idempotencyKey).
            context: { localFirst: true },
          })
            .then(() => onItemAdded?.())
            .catch(() => toastService.error(t('addToPantry.restockFailed')))
            .finally(() => pendingItemIds.current.delete(item.id));
          return;
        }
        pendingItemIds.current.delete(item.id);
        if (result.error) {
          // Real (non-network) error → revert the optimistic item.
          safeEvict(client.cache, 'PantryItem', id);
        } else {
          onItemAdded?.();
        }
      })
      .catch(() => {
        pendingItemIds.current.delete(item.id);
        // Real failure → revert the optimistic item.
        safeEvict(client.cache, 'PantryItem', id);
        toastService.error(t('errors.addItemFailedRetry'));
      })
      // Released on every outcome; a queued create is tracked by the offline
      // queue's pending set from here on.
      .finally(() => unconfirmedCreates.confirm(id));
  };

  // Handle quick add from pantry item suggestion (fire-and-forget)
  // On duplicate: auto-restock by 1 silently
  const handleQuickAddSuggestion = (pantryItem: PantryItemSuggestion) => {
    if (
      !pantryId ||
      state.exitingItems.has(pantryItem.itemId) ||
      pendingItemIds.current.has(pantryItem.itemId)
    )
      return;
    pendingItemIds.current.add(pantryItem.itemId);

    const id = generateEntityId();
    // Publishing this id to `Pantry.itemsConnection` below makes the row
    // tappable, and its detail/edit screens query by it. Hold those off until
    // the server has the row — see `unconfirmedCreates`.
    unconfirmedCreates.mark(id);
    const variables = {
      input: {
        id,
        pantryId,
        itemId: pantryItem.itemId,
      },
    };

    // 1. Start exit animation
    state.startExitAnimation(pantryItem.itemId);

    // 2. Show toast immediately
    toastService.success(
      t(pantrySheetConfig.quickAdd.toastMessageKey, { name: pantryItem.name }),
    );

    // 3. Write the item into the cache before firing, so it shows immediately and
    // stays if the create is queued offline (the queue replays it later, keyed by
    // this id).
    try {
      addToPantryItemsCache(
        client.cache,
        pantryId,
        buildOptimisticPantryItem(
          id,
          {
            pantryId,
            itemName: pantryItem.name,
            itemId: pantryItem.itemId,
          },
          client.cache,
        ),
      );
      writePantryItemDetailStub(client.cache, id, {
        itemId: pantryItem.itemId,
        itemName: pantryItem.name,
      });
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Add Pantry Item (optimistic)',
      });
    }

    // 4. Fire mutation without await (cache update handled by mutation's update callback)
    createPantryItem({ variables, context: { localFirst: true } })
      .then(result => {
        // The duplicate arrives as a typed DuplicatePantryItemError member in
        // `data` (or the legacy PANTRY_ITEM_ALREADY_EXISTS error); check both,
        // else a duplicate would fall through and leave the phantom optimistic
        // item while reporting a false success.
        const duplicateInfo = getPantryItemDuplicateFromResult(
          result.data?.createPantryItem,
          result.error,
        );
        if (duplicateInfo) {
          // Already in the pantry → the server restocks the existing row, not
          // our optimistic cuid. Evict the phantom optimistic item.
          safeEvict(client.cache, 'PantryItem', id);
          // Auto-restock by 1 for quick-add
          restockPantryItem({
            variables: {
              input: {
                id: duplicateInfo.existingPantryItemId,
                quantity: 1,
                // idempotencyKey dedups the restock ledger row on replay.
                idempotencyKey: generateEntityId(),
              },
            },
            // Local-first: queued offline, replayed as the canonical mutation
            // (deduped by its idempotencyKey).
            context: { localFirst: true },
          })
            .then(() => onItemAdded?.())
            .catch(() => toastService.error(t('addToPantry.restockFailed')))
            .finally(() => pendingItemIds.current.delete(pantryItem.itemId));
          return;
        }
        pendingItemIds.current.delete(pantryItem.itemId);
        if (result.error) {
          // Real (non-network) error → revert the optimistic item + restore the
          // suggestion (undo the exit animation).
          safeEvict(client.cache, 'PantryItem', id);
          state.completeExitAnimation(pantryItem.itemId);
        } else {
          onItemAdded?.();
        }
      })
      .catch(() => {
        pendingItemIds.current.delete(pantryItem.itemId);
        // Real failure → revert the optimistic item.
        safeEvict(client.cache, 'PantryItem', id);
        state.completeExitAnimation(pantryItem.itemId);
        toastService.error(t('errors.addItemFailed'));
      })
      // Released on every outcome; a queued create is tracked by the offline
      // queue's pending set from here on.
      .finally(() => unconfirmedCreates.confirm(id));
  };

  const handleExitComplete = (itemId: string) => {
    removeSuggestionFromCache(itemId);
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
