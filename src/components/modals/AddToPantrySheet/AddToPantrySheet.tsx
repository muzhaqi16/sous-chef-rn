import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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
import { useSuggestionDismissal } from '#hooks/items/useSuggestionDismissal';
import { extractNodes } from '#/utils/connectionUtils';
import {
  isPantryItemDuplicateError,
  getPantryItemDuplicateInfo,
} from '#/utils/errors/pantryItemDuplicate';
import { addToPantryItemsCache } from '#hooks/home/pantry/utils';
import { buildOptimisticPantryItem } from '#hooks/home/pantry/buildOptimisticPantryItem';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
import { executeCacheUpdate } from '#/utils/compilerSafeWrappers';
import { generateEntityId } from '#/utils/generateEntityId';
import { AddItemSheet } from '../AddItemSheet/AddItemSheet';
import { useAddItemSheetState } from '../AddItemSheet/useAddItemSheetState';
import type { SuggestionsHookResult } from '../AddItemSheet/types';
import { pantrySheetConfig } from '../AddItemSheet/configs/pantryConfig';
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
  const client = useApolloClient();

  // Add details sheet state
  const [showAddDetails, setShowAddDetails] = useState(false);
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
    update: (cache, { data }) => {
      const payload = data?.createPantryItem;
      if (payload?.__typename !== 'CreatePantryItemPayload' || !pantryId)
        return;
      const pantryItem = payload.pantryItem;

      executeCacheUpdate(
        () => addToPantryItemsCache(cache, pantryId, pantryItem),
        'Cache update failed for createPantryItem:',
      );
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
  // user lands back on it if they cancel. useStandardBottomSheet's
  // dismissOnBlur (default true) dismisses the underlying BottomSheetModal
  // on screen blur and re-presents it on refocus, keeping the global
  // backdrop's ref-count clean.
  const handleScanPress = () => {
    toBarcode({
      source: 'pantry',
      pantryId,
    });
  };

  // Handle add manually press
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
    setShowAddDetails(true);
  };

  // Handle quick add from autocomplete suggestion (fire-and-forget)
  // On duplicate: auto-restock by 1 silently
  const handleQuickAddSearchSuggestion = (item: ItemSuggestion) => {
    if (!pantryId || pendingItemIds.current.has(item.id)) return;

    const id = generateEntityId();
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
    toastService.success(pantrySheetConfig.quickAdd.toastMessage(item.name));

    // 2. Remove suggestion from cache immediately
    removeSuggestionFromCache(item.id);

    // 3. Write the item into the cache before firing, so it shows immediately and
    // stays if the create is queued offline (the queue replays it later, keyed by
    // this id).
    executeCacheUpdate(
      () =>
        addToPantryItemsCache(
          client.cache,
          pantryId,
          buildOptimisticPantryItem(id, {
            pantryId,
            itemName: item.name,
            itemId: item.id,
          }),
        ),
      'Add Pantry Item (optimistic)',
    );

    // 4. Fire mutation without await (cache update handled by mutation's update callback)
    createPantryItem({ variables, context: { localFirst: true } })
      .then(result => {
        if (result.error && isPantryItemDuplicateError(result.error)) {
          const duplicateInfo = getPantryItemDuplicateInfo(result.error);
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
                },
              },
              // Local-first: replay-safe via syncRestockPantryItem (operationId
              // dedups the restock ledger row if the request is queued).
              context: { localFirst: true, operationId: generateEntityId() },
            })
              .then(() => onItemAdded?.())
              .catch(() => toastService.error(t('addToPantry.restockFailed')))
              .finally(() => pendingItemIds.current.delete(item.id));
            return;
          }
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
        toastService.error(t('addToPantry.addFailedRetry'));
      });
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
      pantrySheetConfig.quickAdd.toastMessage(pantryItem.name),
    );

    // 3. Write the item into the cache before firing, so it shows immediately and
    // stays if the create is queued offline (the queue replays it later, keyed by
    // this id).
    executeCacheUpdate(
      () =>
        addToPantryItemsCache(
          client.cache,
          pantryId,
          buildOptimisticPantryItem(id, {
            pantryId,
            itemName: pantryItem.name,
            itemId: pantryItem.itemId,
          }),
        ),
      'Add Pantry Item (optimistic)',
    );

    // 4. Fire mutation without await (cache update handled by mutation's update callback)
    createPantryItem({ variables, context: { localFirst: true } })
      .then(result => {
        if (result.error && isPantryItemDuplicateError(result.error)) {
          const duplicateInfo = getPantryItemDuplicateInfo(result.error);
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
                },
              },
              // Local-first: replay-safe via syncRestockPantryItem (operationId
              // dedups the restock ledger row if the request is queued).
              context: { localFirst: true, operationId: generateEntityId() },
            })
              .then(() => onItemAdded?.())
              .catch(() => toastService.error(t('addToPantry.restockFailed')))
              .finally(() => pendingItemIds.current.delete(pantryItem.itemId));
            return;
          }
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
        toastService.error(t('addToPantry.addFailed'));
      });
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

  // Handle successful add from details sheet
  const handleAddSuccess = () => {
    setShowAddDetails(false);
    suggestionsResult.refetch();
    toastService.success(t('addToPantry.itemAdded'));
    onItemAdded?.();
    onClose();
  };

  // Handle close details sheet
  const handleCloseDetails = () => {
    setShowAddDetails(false);
    setPrefilledItemName('');
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
    >
      {/* Nested Add Details Sheet */}
      <AddDetailsSheet
        visible={showAddDetails}
        pantryId={pantryId}
        prefilledItemName={prefilledItemName}
        storageLocations={storageLocations}
        onClose={handleCloseDetails}
        onSuccess={handleAddSuccess}
      />
    </AddItemSheet>
  );
};
