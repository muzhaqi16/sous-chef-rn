import React from 'react';
import { useTranslation } from 'react-i18next';
import { useApolloClient, useMutation } from '@apollo/client/react';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import {
  useShoppingListSuggestions,
  SHOPPING_SUGGESTIONS_LIMIT,
  ShoppingListSuggestionItem,
} from '#features/shoppingList/hooks/useShoppingListSuggestions';
import { toastService } from '#/services/toastService';
import {
  AddItemToShoppingListDocument,
  GetShoppingListSuggestionsDocument,
  type GetShoppingListSuggestionsQuery,
} from '#features/shoppingList/graphql/shoppingList.generated';
import {
  ItemSuggestion,
  SuggestionSurface,
} from '#/graphql/generated/schemaTypes';
import { useSuggestionDismissal } from '#hooks/items/useSuggestionDismissal';
import {
  addOptimisticShoppingListItem,
  createOptimisticShoppingListItem,
  reconcileShoppingCreate,
  reconcileShoppingItemCreateUpdate,
  revertOptimisticShoppingListItem,
} from '#/apollo/utils/shoppingListCacheUpdaters';
import { executeCacheUpdate } from '#/utils/compilerSafeWrappers';
import { generateEntityId } from '#/utils/generateEntityId';
import { useShowShoppingListImages } from '#hooks/settings/useUserPreferences';
import {
  useShoppingListTutorial,
  ShoppingListTutorialStep,
} from '#features/shoppingList/context/ShoppingListTutorialContext';
import { SheetTutorialHint } from '#components/molecules/SheetTutorialHint';
import { AddItemSheet } from '../AddItemSheet/AddItemSheet';
import { useAddItemSheetState } from '../AddItemSheet/useAddItemSheetState';
import type { SuggestionsHookResult } from '../AddItemSheet/types';
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
    limit: SHOPPING_SUGGESTIONS_LIMIT,
    skip: !visible || !state.shouldFetch,
  });

  // Adapt suggestions to the expected interface
  const suggestions: SuggestionsHookResult<ShoppingListSuggestionItem> = {
    grouped: suggestionsResult.grouped,
    loading: suggestionsResult.loading,
    hasSuggestions: suggestionsResult.hasSuggestions,
    refetch: suggestionsResult.refetch,
  };

  // Dismiss a junk/unwanted suggestion from the SHOPPING surface.
  const { dismissSuggestion } = useSuggestionDismissal(
    SuggestionSurface.Shopping,
    suggestionsResult.refetch,
  );

  const removeFromSuggestionsCache = (itemId: string) => {
    client.cache.updateQuery<GetShoppingListSuggestionsQuery>(
      {
        query: GetShoppingListSuggestionsDocument,
        variables: { id: shoppingListId!, limit: SHOPPING_SUGGESTIONS_LIMIT },
      },
      data => {
        if (!data?.shoppingList) return data;
        const list = data.shoppingList;
        return {
          ...data,
          shoppingList: {
            ...list,
            recentlyDeleted: list.recentlyDeleted.filter(
              s => s.itemId !== itemId,
            ),
            frequentlyAdded: list.frequentlyAdded.filter(
              s => s.itemId !== itemId,
            ),
            popular: list.popular.filter(s => s.itemId !== itemId),
          },
        };
      },
    );
  };

  // Each handler writes the new item into the cache before this mutation fires
  // and leaves it there, so it appears instantly and stays even when the create
  // is queued offline (the queue replays it later, keyed by the item's id). An
  // `optimisticResponse` can't do this — Apollo rolls it back the moment the
  // offline queue completes the request with a null result.
  const [addItemMutation, { loading: adding }] = useMutation(
    AddItemToShoppingListDocument,
    {
      update(cache, { data }, { variables }) {
        const payload = data?.addItemToShoppingList;
        if (
          payload?.__typename !== 'AddItemToShoppingListPayload' ||
          !shoppingListId ||
          !variables
        ) {
          return;
        }
        const newItem = payload.shoppingListItem;
        executeCacheUpdate(
          () =>
            reconcileShoppingItemCreateUpdate(
              cache,
              shoppingListId,
              newItem,
              variables.input.id,
            ),
          'Cache update failed for addItem:',
        );
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

    // 2. Generate the item's id and write it into the cache before firing, so it
    // shows immediately and stays if the create is queued offline (the queue
    // replays it later, keyed by this id).
    const id = generateEntityId();
    const optimisticItem = createOptimisticShoppingListItem(id, {
      itemName: item.name,
      itemId: item.id,
      unitId: item.defaultUnit?.id,
    });
    executeCacheUpdate(
      () =>
        addOptimisticShoppingListItem(
          client.cache,
          shoppingListId,
          optimisticItem,
        ),
      'Add Shopping List Item (optimistic)',
    );

    // 3. Fire mutation without await.
    addItemMutation({
      variables: {
        input: {
          id,
          shoppingListId,
          itemId: item.id,
          itemName: item.name,
          quantity: null,
          unit: item.defaultUnit?.id
            ? { unitId: item.defaultUnit.id }
            : undefined,
        },
      },
      context: { localFirst: true },
    })
      .then(result => {
        // A queued create (offline / API down) resolves with no data and no
        // error — keep the item. A real rejection (e.g. validation) must evict
        // the optimistic item; with errorPolicy:'all' that lands here in `.then`,
        // not `.catch`, so the reconciler classifies the result rather than
        // relying on a throw.
        if (
          reconcileShoppingCreate(client.cache, shoppingListId, id, result) ===
          'reverted'
        ) {
          toastService.error(t('addToShoppingListSheet.addFailedRetry'));
          return;
        }
        onItemAdded?.();
        tutorial?.notifyItemAdded();
      })
      .catch(() => {
        revertOptimisticShoppingListItem(client.cache, shoppingListId, id);
        toastService.error(t('addToShoppingListSheet.addFailedRetry'));
      });
  };

  // Handle quick add from suggestion (fire-and-forget with exit animations)
  const handleQuickAddSuggestion = (
    shoppingItem: ShoppingListSuggestionItem,
  ) => {
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

    // 3. Generate the item's id and write it into the cache before firing, so it
    // shows immediately and stays if the create is queued offline (the queue
    // replays it later, keyed by this id).
    const id = generateEntityId();
    const optimisticItem = createOptimisticShoppingListItem(id, {
      itemName: shoppingItem.name,
      itemId: shoppingItem.itemId,
      unitId,
    });
    executeCacheUpdate(
      () =>
        addOptimisticShoppingListItem(
          client.cache,
          shoppingListId,
          optimisticItem,
        ),
      'Add Shopping List Item (optimistic)',
    );

    // 4. Fire mutation without await.
    addItemMutation({
      variables: {
        input: {
          id,
          shoppingListId,
          itemId: shoppingItem.itemId,
          itemName: shoppingItem.name,
          quantity: null,
          unit: unitId ? { unitId } : undefined,
        },
      },
      context: { localFirst: true },
    })
      .then(result => {
        // Rejected (not merely queued offline) → evict the optimistic item and
        // restore the suggestion. errorPolicy:'all' delivers rejections to
        // `.then`, so the reconciler classifies rather than relying on `.catch`.
        if (
          reconcileShoppingCreate(client.cache, shoppingListId, id, result) ===
          'reverted'
        ) {
          state.completeExitAnimation(shoppingItem.itemId);
          toastService.error(t('addToShoppingListSheet.addFailedRetry'));
          return;
        }
        onItemAdded?.();
        tutorial?.notifyItemAdded();
      })
      .catch(() => {
        // On error: remove from exiting, show error toast
        revertOptimisticShoppingListItem(client.cache, shoppingListId, id);
        state.completeExitAnimation(shoppingItem.itemId);
        toastService.error(t('addToShoppingListSheet.addFailedRetry'));
      });
  };

  // Handle exit animation complete
  const handleExitComplete = (itemId: string) => {
    removeFromSuggestionsCache(itemId);
    state.completeExitAnimation(itemId);
  };

  // Dismiss a suggestion: animate it out (cache removal happens on exit
  // complete, shared with quick-add) and persist the dismissal server-side.
  const handleDismissSuggestion = (item: ShoppingListSuggestionItem) => {
    if (state.exitingItems.has(item.itemId)) return;
    state.startExitAnimation(item.itemId);
    dismissSuggestion({ itemId: item.itemId, name: item.name });
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
      onDismissSuggestion={handleDismissSuggestion}
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
