import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useApolloClient, useMutation } from '@apollo/client/react';
import { type Unmasked } from '@apollo/client/masking';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import {
  useShoppingListSuggestions,
  ShoppingListSuggestionItem,
} from '#features/shoppingList/hooks/useShoppingListSuggestions';
import { toastService } from '#/services/toastService';
import {
  AddItemToShoppingListDocument,
  GetShoppingListSuggestionsDocument,
  type GetShoppingListSuggestionsQuery,
  type AddItemToShoppingListMutation,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { ItemSuggestion } from '#/graphql/generated/schemaTypes';
import { addNewItemToShoppingListCache } from '#/apollo/utils/shoppingListCacheUpdaters';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
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
  const { t } = useTranslation();
  const { toBarcode, toAddItem } = useAppNavigation();
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
  const [addItemMutation, { loading: adding }] = useMutation(
    AddItemToShoppingListDocument,
    {
      optimisticResponse: (
        variables,
      ): Unmasked<AddItemToShoppingListMutation> => {
        const { tempId, entity } = createOptimisticShoppingListItem({
          itemName: variables.input.itemName ?? '',
          itemId: variables.input.itemId,
          unitId: variables.input.unit?.unitId,
        });
        lastTempIdRef.current = tempId;
        return {
          __typename: 'Mutation',
          addItemToShoppingList: {
            __typename: 'ShoppingListItemPayload',
            success: true,
            message: '',
            code: 'SUCCESS',
            shoppingListItem: entity,
          },
        };
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
    },
  );

  // Keep the sheet "open" across the barcode navigation so the user lands
  // back on it if they cancel. useStandardBottomSheet's dismissOnBlur
  // (default true) dismisses the underlying BottomSheetModal on screen blur
  // and re-presents it on refocus, keeping the global backdrop's ref-count
  // clean. Calling onClose() here would flip visible to false before blur,
  // short-circuiting that cleanup and leaving the backdrop stuck on return.
  const handleScanPress = () => {
    toBarcode({
      source: 'shoppingList',
      shoppingListId,
    });
  };

  // Handle add manually press - navigates to AddItem screen
  const handleAddManually = (searchValue: string) => {
    onClose();
    if (shoppingListId) {
      toAddItem({
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
        toastService.error(t('addToShoppingListSheet.addFailedRetry'));
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
        toastService.error(t('addToShoppingListSheet.addFailedRetry'));
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
              ? t('addToShoppingListSheet.tutorialTapPlus')
              : t('addToShoppingListSheet.tutorialTapAddManually')
          }
          onSkip={tutorial.skipAll}
        />
      );
    }

    if (tutorial.currentStep === ShoppingListTutorialStep.HINT_DISMISS_SHEET) {
      return (
        <SheetTutorialHint
          variant="handle"
          text={t('addToShoppingListSheet.tutorialPullDown')}
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
