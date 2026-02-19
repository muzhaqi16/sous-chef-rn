import React, { useState, useCallback, useMemo, useRef } from 'react';
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
  useGetPantryQuery,
  GetPantryItemSuggestionsDocument,
  type GetPantryItemSuggestionsQuery,
  ItemSuggestion,
} from '#generated';
import { normalizePantry } from '#/utils/connectionUtils';
import { createAddToParentConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import {
  isPantryItemDuplicateError,
  getPantryItemDuplicateInfo,
} from '#/utils/errors/pantryItemDuplicate';
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
  onItemAdded,
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
  const suggestions: SuggestionsHookResult = useMemo(() => ({
    grouped: suggestionsResult.grouped as unknown as Record<string, BaseSuggestionItem[]>,
    loading: suggestionsResult.loading,
    hasSuggestions: suggestionsResult.hasSuggestions,
    refetch: suggestionsResult.refetch,
  }), [suggestionsResult]);

  // Fetch pantry to get storage locations
  const { data: pantryData } = useGetPantryQuery({
    variables: { id: pantryId ?? '' },
    skip: !pantryId || !visible,
    fetchPolicy: 'cache-first',
  });

  const normalizedPantry = pantryData?.pantry
    ? normalizePantry(pantryData.pantry)
    : null;
  const storageLocations = normalizedPantry?.storageLocations || [];

  const removeFromSuggestionsCache = useCallback(
    (itemId: string) => {
      client.cache.updateQuery<GetPantryItemSuggestionsQuery>(
        {
          query: GetPantryItemSuggestionsDocument,
          variables: { pantryId: pantryId!, limit: 15 },
        },
        data => {
          if (!data?.pantry) return data;
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
    },
    [client.cache, pantryId],
  );

  // Create pantry item mutation
  const [createPantryItem, { loading: creating }] = useCreatePantryItemMutation({
    errorPolicy: 'all',
    update: (cache, { data }) => {
      const pantryItem = data?.createPantryItem?.pantryItem;
      if (!pantryItem || !pantryId) return;

      try {
        const addToPantryCache = createAddToParentConnectionUpdater(
          'Pantry',
          'itemsConnection',
          'PantryItem',
        );
        addToPantryCache(cache, pantryId, pantryItem);
      } catch (error) {
        console.warn('Cache update failed for createPantryItem:', error);
      }
    },
  });

  // Restock pantry item mutation
  const [restockPantryItem] = useRestockPantryItemMutation({
    errorPolicy: 'all',
  });

  // Track items currently being added to prevent duplicate rapid-fire mutations
  const pendingItemIds = useRef(new Set<string>());

  // Handle scan barcode press
  const handleScanPress = useCallback(() => {
    onClose();
    navigateTo.barcode({
      source: 'pantry',
      pantryId,
    });
  }, [onClose, navigateTo, pantryId]);

  // Handle add manually press
  const handleAddManually = useCallback((searchValue: string) => {
    setPrefilledItemName(searchValue);
    setShowAddDetails(true);
  }, []);

  // Handle quick add from autocomplete suggestion (fire-and-forget)
  // On duplicate: auto-restock by 1 silently
  const handleQuickAddSearchSuggestion = useCallback(
    (item: ItemSuggestion) => {
      if (!pantryId || creating || pendingItemIds.current.has(item.id)) return;

      const variables = {
        input: {
          pantryId,
          itemId: item.id,
          itemName: item.name,
          quantity: null,
        },
      };

      // Mark as pending to prevent duplicate rapid-fire adds
      pendingItemIds.current.add(item.id);

      // 1. Show toast immediately
      toastService.success(pantrySheetConfig.quickAdd.toastMessage(item.name));

      // 2. Optimistically remove from suggestions cache
      removeFromSuggestionsCache(item.id);

      // 3. Fire mutation without await
      createPantryItem({ variables }).then(result => {
        if (result.error && isPantryItemDuplicateError(result.error)) {
          const duplicateInfo = getPantryItemDuplicateInfo(result.error);
          if (duplicateInfo) {
            // Auto-restock by 1 for quick-add
            restockPantryItem({
              variables: {
                id: duplicateInfo.existingPantryItemId,
                input: { quantity: 1 },
              },
            }).then(() => onItemAdded?.())
              .catch(() => toastService.error('Failed to restock item.'))
              .finally(() => pendingItemIds.current.delete(item.id));
            return;
          }
        }
        pendingItemIds.current.delete(item.id);
        if (!result.error) {
          onItemAdded?.();
        }
      }).catch(() => {
        pendingItemIds.current.delete(item.id);
        toastService.error('Failed to add item. Please try again.');
      });
    },
    [pantryId, creating, createPantryItem, restockPantryItem, removeFromSuggestionsCache, onItemAdded],
  );

  // Handle quick add from pantry item suggestion (fire-and-forget)
  // On duplicate: auto-restock by 1 silently
  const handleQuickAddSuggestion = useCallback(
    (item: BaseSuggestionItem) => {
      // Cast to PantryItemSuggestion for full type info
      const pantryItem = item as unknown as PantryItemSuggestion;
      if (!pantryId || creating || state.exitingItems.has(pantryItem.itemId)) return;

      // Also check pendingItemIds to prevent rapid-fire duplicates
      if (pendingItemIds.current.has(pantryItem.itemId)) return;
      pendingItemIds.current.add(pantryItem.itemId);

      const variables = {
        input: {
          pantryId,
          itemId: pantryItem.itemId,
          itemName: pantryItem.name,
          quantity: null,
        },
      };

      // 1. Start exit animation immediately
      state.startExitAnimation(pantryItem.itemId);

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
                input: { quantity: 1 },
              },
            }).then(() => onItemAdded?.())
              .catch(() => toastService.error('Failed to restock item.'))
              .finally(() => pendingItemIds.current.delete(pantryItem.itemId));
            return;
          }
        }
        pendingItemIds.current.delete(pantryItem.itemId);
        if (!result.error) {
          onItemAdded?.();
        }
      }).catch(() => {
        // On error: remove from exiting, show error toast
        pendingItemIds.current.delete(pantryItem.itemId);
        state.completeExitAnimation(pantryItem.itemId);
        toastService.error('Failed to add item');
      });
    },
    [pantryId, creating, state, createPantryItem, restockPantryItem, onItemAdded],
  );

  // Handle exit animation complete
  const handleExitComplete = useCallback(
    (itemId: string) => {
      removeFromSuggestionsCache(itemId);
      state.completeExitAnimation(itemId);
    },
    [removeFromSuggestionsCache, state],
  );

  // Handle successful add from details sheet
  const handleAddSuccess = useCallback(() => {
    setShowAddDetails(false);
    suggestionsResult.refetch();
    toastService.success('Item added to pantry');
    onItemAdded?.();
    onClose();
  }, [suggestionsResult, onItemAdded, onClose]);

  // Handle close details sheet
  const handleCloseDetails = useCallback(() => {
    setShowAddDetails(false);
    setPrefilledItemName('');
  }, []);

  return (
    <AddItemSheet
      visible={visible}
      contextId={pantryId}
      onClose={onClose}
      config={pantrySheetConfig}
      suggestions={suggestions}
      onQuickAddSearchSuggestion={handleQuickAddSearchSuggestion}
      onQuickAddSuggestion={handleQuickAddSuggestion}
      isMutating={creating}
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
