import React, { useCallback, useMemo } from 'react';
import { useApolloClient } from '@apollo/client/react';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import {
  useShoppingListSuggestions,
  ShoppingListSuggestionItem,
} from '#hooks/shoppingList/useShoppingListSuggestions';
import { toastService } from '#/services/toastService';
import {
  useAddItemToShoppingListMutation,
  GetShoppingListSuggestionsDocument,
  GetShoppingListSuggestionsQuery,
  ItemSuggestion,
} from '#generated';
import { createAddToParentConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import { AddItemSheet } from '../AddItemSheet/AddItemSheet';
import { useAddItemSheetState } from '../AddItemSheet/useAddItemSheetState';
import type { BaseSuggestionItem, SuggestionsHookResult } from '../AddItemSheet/types';
import { shoppingListSheetConfig } from '../AddItemSheet/configs/shoppingListConfig';

interface AddToShoppingListSheetProps {
  visible: boolean;
  shoppingListId: string | undefined;
  onClose: () => void;
  /** Initial search query to pre-populate when sheet opens */
  initialSearchQuery?: string;
  /** Called when an item is successfully added */
  onItemAdded?: () => void;
}

export const AddToShoppingListSheet: React.FC<AddToShoppingListSheetProps> = ({
  visible,
  shoppingListId,
  onClose,
  initialSearchQuery = '',
  onItemAdded,
}) => {
  const { navigate, navigateTo } = useAppNavigation();
  const client = useApolloClient();

  // Shared state management (NOW OPTIMIZED: includes shouldFetch and exit animations)
  const state = useAddItemSheetState({
    visible,
    contextId: shoppingListId,
    deferFetch: shoppingListSheetConfig.deferFetch,
  });

  // Fetch shopping list suggestions (NOW OPTIMIZED: respects shouldFetch)
  const suggestionsResult = useShoppingListSuggestions({
    shoppingListId,
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

  // Helper to optimistically remove item from suggestions cache
  const removeFromSuggestionsCache = useCallback(
    (itemId: string) => {
      client.cache.updateQuery<GetShoppingListSuggestionsQuery>(
        {
          query: GetShoppingListSuggestionsDocument,
          variables: { shoppingListId: shoppingListId!, limit: 15 },
        },
        data => {
          if (!data) return data;
          return {
            ...data,
            shoppingListSuggestions: data.shoppingListSuggestions.filter(
              s => s.itemId !== itemId,
            ),
          };
        },
      );
    },
    [client.cache, shoppingListId],
  );

  // Add shopping list item mutation (NOW OPTIMIZED: fire-and-forget pattern)
  const [addItemMutation, { loading: adding }] = useAddItemToShoppingListMutation({
    update: (cache, { data }) => {
      if (!data?.addItemToShoppingList || !shoppingListId) return;

      try {
        const addToShoppingListCache = createAddToParentConnectionUpdater(
          'ShoppingList',
          'itemsConnection',
          'ShoppingListItem',
        );
        addToShoppingListCache(
          cache,
          shoppingListId,
          data.addItemToShoppingList,
        );
      } catch (error) {
        console.error('Cache update failed:', error);
      }
    },
  });

  // Handle scan barcode press
  const handleScanPress = useCallback(() => {
    onClose();
    navigateTo.barcode({
      source: 'shoppingList',
      shoppingListId,
    });
  }, [onClose, navigateTo, shoppingListId]);

  // Handle add manually press - navigates to AddItem screen
  const handleAddManually = useCallback((searchValue: string) => {
    onClose();
    if (shoppingListId) {
      navigate('AddItem', {
        listId: shoppingListId,
        initialItemName: searchValue || undefined,
      });
    }
  }, [onClose, navigate, shoppingListId]);

  // Handle quick add from search autocomplete (NOW OPTIMIZED: fire-and-forget)
  const handleQuickAddSearchSuggestion = useCallback(
    (item: ItemSuggestion) => {
      if (!shoppingListId || adding) return;

      // 1. Show toast immediately (don't wait for mutation)
      toastService.success(shoppingListSheetConfig.quickAdd.toastMessage(item.name));

      // 2. Fire mutation without await
      addItemMutation({
        variables: {
          input: {
            shoppingListId,
            itemId: item.id,
            itemName: item.name,
            quantity: null,
            unitId: item.defaultUnit?.id,
          },
        },
      })
        .then(() => {
          onItemAdded?.();
        })
        .catch(() => {
          toastService.error('Failed to add item. Please try again.');
        });
    },
    [shoppingListId, adding, addItemMutation, onItemAdded],
  );

  // Handle quick add from suggestion (NOW OPTIMIZED: fire-and-forget with exit animations)
  const handleQuickAddSuggestion = useCallback(
    (item: BaseSuggestionItem) => {
      // Cast to ShoppingListSuggestionItem for full type info
      const shoppingItem = item as ShoppingListSuggestionItem;
      if (!shoppingListId || adding || state.exitingItems.has(shoppingItem.itemId)) return;

      // Use lastUnitId if available (for recently deleted), otherwise defaultUnitId
      const unitId = shoppingItem.lastUnitId ?? shoppingItem.defaultUnitId ?? undefined;

      // 1. Start exit animation immediately (NOW OPTIMIZED: added animations)
      state.startExitAnimation(shoppingItem.itemId);

      // 2. Show toast immediately (don't wait for mutation)
      toastService.success(shoppingListSheetConfig.quickAdd.toastMessage(shoppingItem.name));

      // 3. Fire mutation without await
      addItemMutation({
        variables: {
          input: {
            shoppingListId,
            itemId: shoppingItem.itemId,
            itemName: shoppingItem.name,
            quantity: null,
            unitId,
          },
        },
      })
        .then(() => {
          onItemAdded?.();
        })
        .catch(() => {
          // On error: remove from exiting, show error toast
          state.completeExitAnimation(shoppingItem.itemId);
          toastService.error('Failed to add item. Please try again.');
        });
    },
    [shoppingListId, adding, state, addItemMutation, onItemAdded],
  );

  // Handle exit animation complete
  const handleExitComplete = useCallback(
    (itemId: string) => {
      removeFromSuggestionsCache(itemId);
      state.completeExitAnimation(itemId);
    },
    [removeFromSuggestionsCache, state],
  );

  return (
    <AddItemSheet
      visible={visible}
      contextId={shoppingListId}
      onClose={onClose}
      config={shoppingListSheetConfig}
      suggestions={suggestions}
      onQuickAddSearchSuggestion={handleQuickAddSearchSuggestion}
      onQuickAddSuggestion={handleQuickAddSuggestion}
      isMutating={adding}
      onAddManually={handleAddManually}
      onScanPress={handleScanPress}
      exitingItems={state.exitingItems}
      onExitComplete={handleExitComplete}
      shouldFetch={state.shouldFetch}
      initialSearchQuery={initialSearchQuery}
    />
  );
};
