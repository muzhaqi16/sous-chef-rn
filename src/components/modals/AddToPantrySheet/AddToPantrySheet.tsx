import React, { useState, useCallback, useMemo } from 'react';
import { useApolloClient } from '@apollo/client/react';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import {
  usePantryItemSuggestions,
  type PantryItemSuggestion,
} from '#hooks/pantry/usePantryItemSuggestions';
import { toastService } from '#/services/toastService';
import {
  useCreatePantryItemMutation,
  useGetPantryQuery,
  GetPantryItemSuggestionsDocument,
  GetPantryItemSuggestionsQuery,
  ItemSuggestion,
} from '#generated';
import { normalizePantry } from '#/utils/connectionUtils';
import { createAddToParentConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import { AddItemSheet } from '../AddItemSheet/AddItemSheet';
import { useAddItemSheetState } from '../AddItemSheet/useAddItemSheetState';
import type { BaseSuggestionItem, SuggestionsHookResult } from '../AddItemSheet/types';
import { pantrySheetConfig } from '../AddItemSheet/configs/pantryConfig';
import { AddDetailsSheet } from './AddDetailsSheet';

interface AddToPantrySheetProps {
  visible: boolean;
  pantryId: string | undefined;
  onClose: () => void;
}

export const AddToPantrySheet: React.FC<AddToPantrySheetProps> = ({
  visible,
  pantryId,
  onClose,
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

  // Helper to optimistically remove item from suggestions cache
  const removeFromSuggestionsCache = useCallback(
    (itemId: string) => {
      client.cache.updateQuery<GetPantryItemSuggestionsQuery>(
        {
          query: GetPantryItemSuggestionsDocument,
          variables: { pantryId: pantryId!, limit: 15 },
        },
        data => {
          if (!data) return data;
          return {
            ...data,
            pantryItemSuggestions: data.pantryItemSuggestions.filter(
              s => s.itemId !== itemId,
            ),
          };
        },
      );
    },
    [client.cache, pantryId],
  );

  // Create pantry item mutation
  const [createPantryItem, { loading: creating }] = useCreatePantryItemMutation({
    update: (cache, { data }) => {
      if (!data?.createPantryItem || !pantryId) return;

      try {
        const addToPantryCache = createAddToParentConnectionUpdater(
          'Pantry',
          'itemsConnection',
          'PantryItem',
        );
        addToPantryCache(cache, pantryId, data.createPantryItem);
      } catch (error) {
        console.warn('Cache update failed for createPantryItem:', error);
      }
    },
  });

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
  const handleQuickAddSearchSuggestion = useCallback(
    (item: ItemSuggestion) => {
      if (!pantryId || creating) return;

      // 1. Show toast immediately
      toastService.success(pantrySheetConfig.quickAdd.toastMessage(item.name, 1));

      // 2. Optimistically remove from suggestions cache
      removeFromSuggestionsCache(item.id);

      // 3. Fire mutation without await
      createPantryItem({
        variables: {
          input: {
            pantryId,
            itemId: item.id,
            itemName: item.name,
            quantity: 1,
          },
        },
      }).catch(() => {
        toastService.error('Failed to add item. Please try again.');
      });
    },
    [pantryId, creating, createPantryItem, removeFromSuggestionsCache],
  );

  // Handle quick add from pantry item suggestion (fire-and-forget)
  const handleQuickAddSuggestion = useCallback(
    (item: BaseSuggestionItem) => {
      // Cast to PantryItemSuggestion for full type info
      const pantryItem = item as PantryItemSuggestion;
      if (!pantryId || creating || state.exitingItems.has(pantryItem.itemId)) return;

      // 1. Start exit animation immediately
      state.startExitAnimation(pantryItem.itemId);

      // 2. Show toast immediately
      toastService.success(pantrySheetConfig.quickAdd.toastMessage(pantryItem.name, 1));

      // 3. Fire mutation without await
      createPantryItem({
        variables: {
          input: {
            pantryId,
            itemId: pantryItem.itemId,
            itemName: pantryItem.name,
            quantity: 1,
          },
        },
      }).catch(() => {
        // On error: remove from exiting, show error toast
        state.completeExitAnimation(pantryItem.itemId);
        toastService.error('Failed to add item');
      });
    },
    [pantryId, creating, state, createPantryItem],
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
  }, [suggestionsResult]);

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
