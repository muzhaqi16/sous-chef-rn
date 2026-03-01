import React, { useState, useRef, useEffect } from 'react';
import { useApolloClient } from '@apollo/client/react';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import {
  usePantryItemSuggestions,
  type PantryItemSuggestion } from '#hooks/pantry/usePantryItemSuggestions';
import { toastService } from '#/services/toastService';
import {
  useCreatePantryItemMutation,
  useRestockPantryItemMutation,
  GetPantryDocument,
  type GetPantryQuery,
  GetPantryItemSuggestionsDocument,
  type GetPantryItemSuggestionsQuery,
  ItemSuggestion } from '#generated';
import { normalizePantry } from '#/utils/connectionUtils';
import {
  isPantryItemDuplicateError,
  getPantryItemDuplicateInfo } from '#/utils/errors/pantryItemDuplicate';
import { addToPantryItemsCache, batchAddToPantryItemsCache } from '#hooks/home/pantry/utils';
import { apolloCachePersistence } from '#/apollo/offline/ApolloCachePersistence';
import type { StorageLocation } from '#hooks/autocomplete/useStorageLocationAutocomplete';
import { AddItemSheet } from '../AddItemSheet/AddItemSheet';
import { useAddItemSheetState } from '../AddItemSheet/useAddItemSheetState';
import type { BaseSuggestionItem, SuggestionsHookResult } from '../AddItemSheet/types';
import { pantrySheetConfig } from '../AddItemSheet/configs/pantryConfig';
import { AddDetailsSheet } from './AddDetailsSheet';

interface AddToPantrySheetProps {
  visible: boolean;
  pantryId: string | undefined;
  onClose: () => void;
  onItemAdded?: () => void;
}

export const AddToPantrySheet: React.FC<AddToPantrySheetProps> = ({
  visible,
  pantryId,
  onClose,
  onItemAdded }) => {
  const { navigateTo } = useAppNavigation();
  const client = useApolloClient();

  // Add details sheet state
  const [showAddDetails, setShowAddDetails] = useState(false);
  const [prefilledItemName, setPrefilledItemName] = useState('');

  // Shared state management
  const state = useAddItemSheetState({
    visible,
    contextId: pantryId,
    deferFetch: pantrySheetConfig.deferFetch });

  // Fetch pantry item suggestions
  const suggestionsResult = usePantryItemSuggestions({
    pantryId,
    limit: 15,
    skip: !visible || !state.shouldFetch });

  // Adapt suggestions to the expected interface
  const suggestions: SuggestionsHookResult = ({
    grouped: suggestionsResult.grouped,
    loading: suggestionsResult.loading,
    hasSuggestions: suggestionsResult.hasSuggestions,
    refetch: suggestionsResult.refetch });

  // Auto-refetch when suggestions are nearly depleted
  const REFETCH_THRESHOLD = 3;
  const hasAddedItemRef = useRef(false);

  const totalFilteredCount = Object.values(suggestions.grouped).reduce((sum, items) => sum + items.length, 0);

  const isRefetchingRef = useRef(false);

  useEffect(() => {
    if (totalFilteredCount <= REFETCH_THRESHOLD && hasAddedItemRef.current && !isRefetchingRef.current) {
      isRefetchingRef.current = true;
      suggestionsResult.refetch().then(() => {
        isRefetchingRef.current = false;
        hasAddedItemRef.current = false;
      });
    }
  }, [totalFilteredCount, suggestionsResult]);

  // Storage locations read on-demand from cache (no active watcher)
  const [storageLocations, setStorageLocations] = useState<StorageLocation[]>([]);

  // Create pantry item mutation
  // Cache updates are batched and deferred — see flushPendingCacheUpdates
  const [createPantryItem] = useCreatePantryItemMutation({
    errorPolicy: 'all',
  });

  // Restock pantry item mutation
  const [restockPantryItem] = useRestockPantryItemMutation({
    errorPolicy: 'all',
    update: (cache, { data }) => {
      const pantryItem = data?.restockPantryItem?.pantryItemUsage?.pantryItem;
      if (!pantryItem || !pantryId) return;
      // Force connection cache broadcast — the item already exists,
      // so addToPantryItemsCache will detect the duplicate and return
      // the existing connection unchanged, but cache.modify still
      // triggers query watchers to re-emit.
      addToPantryItemsCache(cache, pantryId, pantryItem);
    },
  });

  // Track items currently being added to prevent duplicate rapid-fire mutations
  const pendingItemIds = useRef(new Set<string>());

  // Batch queue: collect mutation results, flush in single cache.batch()
  const pendingCacheUpdates = useRef<Array<{ id: string }>>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleCallbackRef = useRef<number | null>(null);

  // Batch queue for suggestion cache removals
  const pendingSuggestionRemovals = useRef<string[]>([]);

  const flushPendingCacheUpdates = () => {
    const items = pendingCacheUpdates.current;
    const suggestionIds = pendingSuggestionRemovals.current;
    if (items.length === 0 && suggestionIds.length === 0) return;
    if (!pantryId) return;

    pendingCacheUpdates.current = [];
    pendingSuggestionRemovals.current = [];

    client.cache.batch({
      update(cache) {
        if (items.length > 0) {
          batchAddToPantryItemsCache(cache, pantryId, items);
          cache.modify({
            id: cache.identify({ __typename: 'Pantry', id: pantryId }),
            fields: {
              stats(existingStats: any) {
                if (!existingStats) return existingStats;
                return { ...existingStats, totalItems: (existingStats.totalItems || 0) + items.length };
              },
            },
          });
        }
        if (suggestionIds.length > 0) {
          cache.updateQuery<GetPantryItemSuggestionsQuery>(
            {
              query: GetPantryItemSuggestionsDocument,
              variables: { pantryId, limit: 15 } },
            data => {
              if (!data?.pantry) return data;
              const removeSet = new Set(suggestionIds);
              return {
                ...data,
                pantry: {
                  ...data.pantry,
                  suggestions: data.pantry.suggestions.filter(
                    s => !removeSet.has(s.itemId),
                  ) } };
            },
          );
        }
      },
    });

    // Resume persistence after batch flush
    apolloCachePersistence.resume();
  };

  const scheduleBatchFlush = () => {
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(() => {
      // Defer to idle callback so we don't block animations/touch handling
      if (
        typeof globalThis !== 'undefined' &&
        'requestIdleCallback' in globalThis
      ) {
        // justified: requestIdleCallback not in React Native's global type definitions
        idleCallbackRef.current = (globalThis as any).requestIdleCallback(
          flushPendingCacheUpdates,
          { timeout: 2000 },
        );
      } else {
        flushPendingCacheUpdates();
      }
    }, 150);
  };

  const queueCacheUpdate = (pantryItem: { id: string }) => {
    // Pause persistence on first queued item to prevent serialization during burst
    if (pendingCacheUpdates.current.length === 0 && pendingSuggestionRemovals.current.length === 0) {
      apolloCachePersistence.pause();
    }
    pendingCacheUpdates.current.push(pantryItem);
    scheduleBatchFlush();
  };

  const queueSuggestionRemoval = (itemId: string) => {
    // Pause persistence on first queued item to prevent serialization during burst
    if (pendingCacheUpdates.current.length === 0 && pendingSuggestionRemovals.current.length === 0) {
      apolloCachePersistence.pause();
    }
    pendingSuggestionRemovals.current.push(itemId);
    scheduleBatchFlush();
  };

  // Flush pending cache updates on unmount and ensure persistence is resumed
  useEffect(() => {
    return () => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
      }
      if (idleCallbackRef.current != null && typeof globalThis !== 'undefined' && 'cancelIdleCallback' in globalThis) {
        (globalThis as any).cancelIdleCallback(idleCallbackRef.current); // justified: cancelIdleCallback not in RN types
      }
      const items = pendingCacheUpdates.current;
      const suggestionIds = pendingSuggestionRemovals.current;
      pendingCacheUpdates.current = [];
      pendingSuggestionRemovals.current = [];

      if (pantryId && (items.length > 0 || suggestionIds.length > 0)) {
        client.cache.batch({
          update(cache) {
            if (items.length > 0) {
              batchAddToPantryItemsCache(cache, pantryId, items);
              cache.modify({
                id: cache.identify({ __typename: 'Pantry', id: pantryId }),
                fields: {
                  stats(existingStats: any) {
                    if (!existingStats) return existingStats;
                    return { ...existingStats, totalItems: (existingStats.totalItems || 0) + items.length };
                  },
                },
              });
            }
            if (suggestionIds.length > 0) {
              cache.updateQuery<GetPantryItemSuggestionsQuery>(
                {
                  query: GetPantryItemSuggestionsDocument,
                  variables: { pantryId, limit: 15 } },
                data => {
                  if (!data?.pantry) return data;
                  const removeSet = new Set(suggestionIds);
                  return {
                    ...data,
                    pantry: {
                      ...data.pantry,
                      suggestions: data.pantry.suggestions.filter(
                        s => !removeSet.has(s.itemId),
                      ) } };
                },
              );
            }
          },
        });
      }

      // Always resume persistence on unmount to prevent leaving it paused
      apolloCachePersistence.resume();
    };
  }, [client, pantryId]);

  // Handle scan barcode press
  const handleScanPress = () => {
    onClose();
    navigateTo.barcode({
      source: 'pantry',
      pantryId });
  };

  // Handle add manually press
  const handleAddManually = (searchValue: string) => {
    // Read storage locations from Apollo cache (one-shot, no watcher)
    const cached = client.readQuery<GetPantryQuery>({
      query: GetPantryDocument,
      variables: { id: pantryId ?? '' },
    });
    const normalized = cached?.pantry ? normalizePantry(cached.pantry) : null;
    setStorageLocations(normalized?.storageLocations || []);
    setPrefilledItemName(searchValue);
    setShowAddDetails(true);
  };

  // Handle quick add from autocomplete suggestion (fire-and-forget)
  // On duplicate: auto-restock by 1 silently
  const handleQuickAddSearchSuggestion = (item: ItemSuggestion) => {
      if (!pantryId || pendingItemIds.current.has(item.id)) return;

      const variables = {
        input: {
          pantryId,
          itemId: item.id } };

      // Mark as pending to prevent duplicate rapid-fire adds
      pendingItemIds.current.add(item.id);

      // 1. Show toast immediately
      toastService.success(pantrySheetConfig.quickAdd.toastMessage(item.name));

      // 2. Optimistically queue suggestion removal (batched)
      queueSuggestionRemoval(item.id);

      // 3. Fire mutation without await
      createPantryItem({ variables }).then(result => {
        if (result.error && isPantryItemDuplicateError(result.error)) {
          const duplicateInfo = getPantryItemDuplicateInfo(result.error);
          if (duplicateInfo) {
            // Auto-restock by 1 for quick-add
            restockPantryItem({
              variables: {
                id: duplicateInfo.existingPantryItemId,
                input: { quantity: 1 } } }).then(() => onItemAdded?.())
              .catch(() => toastService.error('Failed to restock item.'))
              .finally(() => pendingItemIds.current.delete(item.id));
            return;
          }
        }
        pendingItemIds.current.delete(item.id);
        if (!result.error) {
          const resultItem = result.data?.createPantryItem?.pantryItem;
          if (resultItem) {
            queueCacheUpdate(resultItem);
          }
          onItemAdded?.();
        }
      }).catch(() => {
        pendingItemIds.current.delete(item.id);
        toastService.error('Failed to add item. Please try again.');
      });
    };

  // Handle quick add from pantry item suggestion (fire-and-forget)
  // On duplicate: auto-restock by 1 silently
  const handleQuickAddSuggestion = (item: BaseSuggestionItem) => {
      // Cast to PantryItemSuggestion for full type info
      const pantryItem = item as unknown as PantryItemSuggestion;
      if (!pantryId || state.exitingItems.has(pantryItem.itemId) || pendingItemIds.current.has(pantryItem.itemId)) return;
      pendingItemIds.current.add(pantryItem.itemId);

      const variables = {
        input: {
          pantryId,
          itemId: pantryItem.itemId } };

      // 1. Start exit animation and mark as having added an item
      state.startExitAnimation(pantryItem.itemId);
      hasAddedItemRef.current = true;

      // 2. Show toast immediately
      toastService.success(pantrySheetConfig.quickAdd.toastMessage(pantryItem.name));

      // 3. Fire mutation without await
      createPantryItem({ variables }).then(result => {
        if (result.error && isPantryItemDuplicateError(result.error)) {
          const duplicateInfo = getPantryItemDuplicateInfo(result.error);
          if (duplicateInfo) {
            // Auto-restock by 1 for quick-add
            restockPantryItem({
              variables: {
                id: duplicateInfo.existingPantryItemId,
                input: { quantity: 1 } } }).then(() => onItemAdded?.())
              .catch(() => toastService.error('Failed to restock item.'))
              .finally(() => pendingItemIds.current.delete(pantryItem.itemId));
            return;
          }
        }
        pendingItemIds.current.delete(pantryItem.itemId);
        if (!result.error) {
          const resultItem = result.data?.createPantryItem?.pantryItem;
          if (resultItem) {
            queueCacheUpdate(resultItem);
          }
          onItemAdded?.();
        }
      }).catch(() => {
        // On error: cancel pending suggestion removal and show item again for retry
        pendingItemIds.current.delete(pantryItem.itemId);
        pendingSuggestionRemovals.current = pendingSuggestionRemovals.current.filter(
          id => id !== pantryItem.itemId,
        );
        state.completeExitAnimation(pantryItem.itemId);
        toastService.error('Failed to add item');
      });
    };

  // Handle exit animation complete — batch the suggestion removal.
  // Item stays in exitingItems (hidden at opacity:0) until the batched
  // cache update removes it from the data array. exitingItems is cleared
  // automatically when the sheet reopens (useAddItemSheetState).
  const handleExitComplete = (itemId: string) => {
      queueSuggestionRemoval(itemId);
    };

  // Handle successful add from details sheet
  const handleAddSuccess = () => {
    setShowAddDetails(false);
    suggestionsResult.refetch();
    toastService.success('Item added to pantry');
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
      isMutating={false}
      onAddManually={handleAddManually}
      onScanPress={handleScanPress}
      exitingItems={state.exitingItems}
      onExitComplete={handleExitComplete}
      shouldFetch={state.shouldFetch}
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
