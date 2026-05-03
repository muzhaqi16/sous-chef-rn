import React, { useRef } from 'react';
import { useApolloClient } from '@apollo/client/react';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import {
  useShoppingListSuggestions,
  ShoppingListSuggestionItem,
} from '#features/shoppingList/hooks/useShoppingListSuggestions';
import { toastService } from '#/services/toastService';
import {
  useAddItemToShoppingListMutation,
  GetShoppingListSuggestionsDocument,
  type GetShoppingListSuggestionsQuery,
  type AddItemToShoppingListMutationVariables,
  ItemSuggestion,
} from '#generated';
import { addNewItemToShoppingListCache } from '#/apollo/utils/shoppingListCacheUpdaters';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
import { buildOptimisticMutationResponse } from '#/apollo/utils/optimisticTypes';
import { createOptimisticShoppingListItem } from '#features/shoppingList/hooks/mutations/utils';
import { executeCacheUpdate } from '#/utils/compilerSafeWrappers';
import { useShowShoppingListImages } from '#hooks/settings/useUserPreferences';
import {
  useShoppingListTutorial,
  ShoppingListTutorialStep,
} from '#features/shoppingList/context/ShoppingListTutorialContext';
import { SheetTutorialHint } from '#components/molecules/SheetTutorialHint';
import { AddItemSheet } from '../AddItemSheet/AddItemSheet';
import { useAddItemSheetState } from '../AddItemSheet/useAddItemSheetState';
import type {
  BaseSuggestionItem,
  SuggestionsHookResult,
} from '../AddItemSheet/types';
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
  const showImages = useShowShoppingListImages();
  const tutorial = useShoppingListTutorial();

  // Shared state management for sheet visibility and deferred data fetching
  const state = useAddItemSheetState({
    visible,
    contextId: shoppingListId,
    deferFetch: shoppingListSheetConfig.deferFetch,
  });

  // Fetch shopping list suggestions (deferred until sheet animation completes)
  const suggestionsResult = useShoppingListSuggestions({
    shoppingListId,
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

  const removeFromSuggestionsCache = (itemId: string) => {
    client.cache.updateQuery<GetShoppingListSuggestionsQuery>(
      {
        query: GetShoppingListSuggestionsDocument,
        variables: { id: shoppingListId!, limit: 15 },
      },
      data => {
        if (!data?.shoppingList) return data;
        return {
          ...data,
          shoppingList: {
            ...data.shoppingList,
            suggestions: data.shoppingList.suggestions.filter(
              s => s.itemId !== itemId,
            ),
          },
        };
      },
    );
  };

  // Track temp ID for optimistic response cleanup
  const lastTempIdRef = useRef<string | null>(null);

  // Add shopping list item mutation with optimistic response for instant UI
  const [addItemMutation, { loading: adding }] =
    useAddItemToShoppingListMutation({
      errorPolicy: 'all',
      optimisticResponse: (
        variables: AddItemToShoppingListMutationVariables,
      ) => {
        const { tempId, entity } = createOptimisticShoppingListItem({
          itemName: variables.input.itemName ?? '',
          itemId: variables.input.itemId,
          unitId: variables.input.unit?.unitId,
        });
        lastTempIdRef.current = tempId;
        return buildOptimisticMutationResponse(
          'addItemToShoppingList',
          'ShoppingListItemPayload',
          'shoppingListItem',
          entity,
        );
      },
      update(cache, { data }) {
        const newItem = data?.addItemToShoppingList?.shoppingListItem;
        if (!newItem || !shoppingListId) return;

        // Evict temp-ID entity when the real server response arrives
        if (lastTempIdRef.current && !newItem.id.startsWith('temp-')) {
          safeEvict(cache, 'ShoppingListItem', lastTempIdRef.current);
          lastTempIdRef.current = null;
        }

        executeCacheUpdate(
          () => addNewItemToShoppingListCache(cache, shoppingListId, newItem),
          'Cache update failed for addItem:',
        );
      },
      onError: () => {
        lastTempIdRef.current = null;
      },
    });

  // Handle scan barcode press
  const handleScanPress = () => {
    onClose();
    navigateTo.barcode({
      source: 'shoppingList',
      shoppingListId,
    });
  };

  // Handle add manually press - navigates to AddItem screen
  const handleAddManually = (searchValue: string) => {
    onClose();
    if (shoppingListId) {
      navigate('AddItem', {
        listId: shoppingListId,
        initialItemName: searchValue || undefined,
      });
    }
  };

  // Handle quick add from search autocomplete (fire-and-forget)
  const handleQuickAddSearchSuggestion = (item: ItemSuggestion) => {
    if (!shoppingListId || adding) return;

    // 1. Show toast immediately (don't wait for mutation)
    toastService.success(
      shoppingListSheetConfig.quickAdd.toastMessage(item.name),
    );

    // 2. Fire mutation without await
    addItemMutation({
      variables: {
        input: {
          shoppingListId,
          itemId: item.id,
          itemName: item.name,
          quantity: null,
          unit: item.defaultUnit?.id
            ? { unitId: item.defaultUnit.id }
            : undefined,
        },
      },
    })
      .then(() => {
        onItemAdded?.();
        tutorial?.notifyItemAdded();
      })
      .catch(() => {
        toastService.error('Failed to add item. Please try again.');
      });
  };

  // Handle quick add from suggestion (fire-and-forget with exit animations)
  const handleQuickAddSuggestion = (item: BaseSuggestionItem) => {
    // Cast to ShoppingListSuggestionItem for full type info
    const shoppingItem = item as unknown as ShoppingListSuggestionItem;
    if (
      !shoppingListId ||
      adding ||
      state.exitingItems.has(shoppingItem.itemId)
    )
      return;

    // Use lastUnitId if available (for recently deleted), otherwise defaultUnitId
    const unitId =
      shoppingItem.lastUnitId ?? shoppingItem.defaultUnitId ?? undefined;

    // 1. Start exit animation
    state.startExitAnimation(shoppingItem.itemId);

    // 2. Show toast immediately (don't wait for mutation)
    toastService.success(
      shoppingListSheetConfig.quickAdd.toastMessage(shoppingItem.name),
    );

    // 3. Fire mutation without await
    addItemMutation({
      variables: {
        input: {
          shoppingListId,
          itemId: shoppingItem.itemId,
          itemName: shoppingItem.name,
          quantity: null,
          unit: unitId ? { unitId } : undefined,
        },
      },
    })
      .then(() => {
        onItemAdded?.();
        tutorial?.notifyItemAdded();
      })
      .catch(() => {
        // On error: remove from exiting, show error toast
        state.completeExitAnimation(shoppingItem.itemId);
        toastService.error('Failed to add item. Please try again.');
      });
  };

  // Handle exit animation complete
  const handleExitComplete = (itemId: string) => {
    removeFromSuggestionsCache(itemId);
    state.completeExitAnimation(itemId);
  };

  // Build tutorial hint for the add item sheet (steps 2 and 3)
  const tutorialHintElement = (() => {
    if (!tutorial?.isActive) return undefined;

    if (tutorial.currentStep === ShoppingListTutorialStep.GUIDE_ADD_ITEM) {
      return (
        <SheetTutorialHint
          variant="inline"
          text={
            suggestions.hasSuggestions
              ? 'Tap + next to an item to add it'
              : 'Tap "Add Manually" to add an item'
          }
          onSkip={tutorial.skipAll}
        />
      );
    }

    if (tutorial.currentStep === ShoppingListTutorialStep.HINT_DISMISS_SHEET) {
      return (
        <SheetTutorialHint
          variant="handle"
          text="Pull down to close"
          onSkip={tutorial.skipAll}
        />
      );
    }

    return undefined;
  })();

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
      showImages={showImages}
      tutorialHint={tutorialHintElement}
    />
  );
};
