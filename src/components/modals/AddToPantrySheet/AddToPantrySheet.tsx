import React, { useState, useRef } from 'react';
import { useApolloClient } from '@apollo/client/react';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import {
  usePantryItemSuggestions,
  type PantryItemSuggestion,
} from '#hooks/pantry/usePantryItemSuggestions';
import { toastService } from '#/services/toastService';
import {
  useCreatePantryItemMutation,
  useRestockPantryItemMutation,
  GetPantryDocument,
  type GetPantryQuery,
  GetPantryItemSuggestionsDocument,
  type GetPantryItemSuggestionsQuery,
  ItemSuggestion,
} from '#generated';
import { normalizePantry } from '#/utils/connectionUtils';
import {
  isPantryItemDuplicateError,
  getPantryItemDuplicateInfo,
} from '#/utils/errors/pantryItemDuplicate';
import { addToPantryItemsCache } from '#hooks/home/pantry/utils';
import { executeCacheUpdate } from '#/utils/compilerSafeWrappers';
import type { StorageLocation } from '#generated';
import { AddItemSheet } from '../AddItemSheet/AddItemSheet';
import { useAddItemSheetState } from '../AddItemSheet/useAddItemSheetState';
import type {
  BaseSuggestionItem,
  SuggestionsHookResult,
} from '../AddItemSheet/types';
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
  const { navigateTo } = useAppNavigation();
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
    limit: 15,
    skip: !visible || !state.shouldFetch,
  });

  // Adapt suggestions to the expected interface
  const suggestions: SuggestionsHookResult = {
    grouped: suggestionsResult.grouped,
    loading: suggestionsResult.loading,
    hasSuggestions: suggestionsResult.hasSuggestions,
    refetch: suggestionsResult.refetch,
  };

  // Storage locations read on-demand from cache (no active watcher)
  const [storageLocations, setStorageLocations] = useState<StorageLocation[]>(
    [],
  );

  // Create pantry item mutation — synchronous cache update prevents flickering
  const [createPantryItem] = useCreatePantryItemMutation({
    errorPolicy: 'all',
    update: (cache, { data }) => {
      const pantryItem = data?.createPantryItem?.pantryItem;
      if (!pantryItem || !pantryId) return;

      executeCacheUpdate(() => {
        addToPantryItemsCache(cache, pantryId, pantryItem);
        cache.modify({
          id: cache.identify({ __typename: 'Pantry', id: pantryId }),
          fields: {
            stats(existingStats: any) {
              if (!existingStats) return existingStats;
              return {
                ...existingStats,
                totalItems: (existingStats.totalItems || 0) + 1,
              };
            },
          },
        });
      }, 'Cache update failed for createPantryItem:');
    },
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

  // Remove a suggestion from the cache synchronously
  const removeSuggestionFromCache = (itemId: string) => {
    if (!pantryId) return;
    client.cache.updateQuery<GetPantryItemSuggestionsQuery>(
      {
        query: GetPantryItemSuggestionsDocument,
        variables: { pantryId, limit: 15 },
      },
      data => {
        if (!data?.pantry?.suggestions) return data;
        return {
          ...data,
          pantry: {
            ...data.pantry,
            suggestions: data.pantry.suggestions.filter(
              s => s.itemId !== itemId,
            ),
          },
        };
      },
    );
  };

  // Handle scan barcode press
  const handleScanPress = () => {
    onClose();
    navigateTo.barcode({
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
        itemId: item.id,
      },
    };

    // Mark as pending to prevent duplicate rapid-fire adds
    pendingItemIds.current.add(item.id);

    // 1. Show toast immediately
    toastService.success(pantrySheetConfig.quickAdd.toastMessage(item.name));

    // 2. Remove suggestion from cache immediately
    removeSuggestionFromCache(item.id);

    // 3. Fire mutation without await (cache update handled by mutation's update callback)
    createPantryItem({ variables })
      .then(result => {
        if (result.error && isPantryItemDuplicateError(result.error)) {
          const duplicateInfo = getPantryItemDuplicateInfo(result.error);
          if (duplicateInfo) {
            // Auto-restock by 1 for quick-add
            restockPantryItem({
              variables: {
                id: duplicateInfo.existingPantryItemId,
                input: { quantity: 1 },
              },
            })
              .then(() => onItemAdded?.())
              .catch(() => toastService.error('Failed to restock item.'))
              .finally(() => pendingItemIds.current.delete(item.id));
            return;
          }
        }
        pendingItemIds.current.delete(item.id);
        if (!result.error) {
          onItemAdded?.();
        }
      })
      .catch(() => {
        pendingItemIds.current.delete(item.id);
        toastService.error('Failed to add item. Please try again.');
      });
  };

  // Handle quick add from pantry item suggestion (fire-and-forget)
  // On duplicate: auto-restock by 1 silently
  const handleQuickAddSuggestion = (item: BaseSuggestionItem) => {
    // Cast to PantryItemSuggestion for full type info
    const pantryItem = item as unknown as PantryItemSuggestion;
    if (
      !pantryId ||
      state.exitingItems.has(pantryItem.itemId) ||
      pendingItemIds.current.has(pantryItem.itemId)
    )
      return;
    pendingItemIds.current.add(pantryItem.itemId);

    const variables = {
      input: {
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

    // 3. Fire mutation without await (cache update handled by mutation's update callback)
    createPantryItem({ variables })
      .then(result => {
        if (result.error && isPantryItemDuplicateError(result.error)) {
          const duplicateInfo = getPantryItemDuplicateInfo(result.error);
          if (duplicateInfo) {
            // Auto-restock by 1 for quick-add
            restockPantryItem({
              variables: {
                id: duplicateInfo.existingPantryItemId,
                input: { quantity: 1 },
              },
            })
              .then(() => onItemAdded?.())
              .catch(() => toastService.error('Failed to restock item.'))
              .finally(() => pendingItemIds.current.delete(pantryItem.itemId));
            return;
          }
        }
        pendingItemIds.current.delete(pantryItem.itemId);
        if (!result.error) {
          onItemAdded?.();
        }
      })
      .catch(() => {
        pendingItemIds.current.delete(pantryItem.itemId);
        state.completeExitAnimation(pantryItem.itemId);
        toastService.error('Failed to add item');
      });
  };

  const handleExitComplete = (itemId: string) => {
    removeSuggestionFromCache(itemId);
    state.completeExitAnimation(itemId);
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
