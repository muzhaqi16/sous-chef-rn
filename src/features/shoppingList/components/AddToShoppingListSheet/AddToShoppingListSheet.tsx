import React, { useState } from 'react';
import { useTranslation } from '#/i18n';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import {
  useShoppingListSuggestions,
  SHOPPING_SUGGESTIONS_LIMIT,
  ShoppingListSuggestionItem,
} from '#features/shoppingList/hooks/useShoppingListSuggestions';
import { toastService } from '#/services/toastService';
import { useAddToShoppingList } from '#features/shoppingList/hooks/useAddToShoppingList';
import {
  ItemSuggestion,
  SuggestionSurface,
} from '#/graphql/generated/schemaTypes';
import { useSuggestionDismissal } from '#features/catalog/hooks/useSuggestionDismissal';
import { useShowShoppingListImages } from '#hooks/settings/useUserPreferences';
import {
  useShoppingListTutorial,
  ShoppingListTutorialStep,
} from '#features/shoppingList/context/ShoppingListTutorialContext';
import { SheetTutorialHint } from '#components/molecules/SheetTutorialHint';
import { AddItemSheet } from '#features/catalog/ui/AddItemSheet/AddItemSheet';
import { useAddItemSheetState } from '#features/catalog/ui/AddItemSheet/useAddItemSheetState';
import type { SuggestionsHookResult } from '#features/catalog/ui/AddItemSheet/types';
import { shoppingListSheetConfig } from '#features/shoppingList/components/AddToShoppingListSheet/shoppingListSheetConfig';
import { ShoppingListDetailsStep } from './ShoppingListDetailsStep';

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
  const { toBarcode } = useAppNavigation();
  const { addItem, removeSuggestion, adding } = useAddToShoppingList({
    shoppingListId,
    suggestionsLimit: SHOPPING_SUGGESTIONS_LIMIT,
  });
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

  // Keep the sheet "open" across the barcode navigation so the user lands
  // back on it if they cancel. useStandardBottomSheet dismisses the underlying
  // BottomSheetModal when the screen blurs but preserves `visible`, so its
  // focus effect re-presents the sheet on return. Calling onClose() here would
  // flip `visible` to false before the blur, so the sheet would stay closed on
  // return instead of restoring.
  const handleScanPress = () => {
    toBarcode({
      source: 'shoppingList',
      shoppingListId,
    });
  };

  // Prefilled name for the in-place details step. The shared AddItemSheet morphs
  // to the details form itself (see renderDetails); here we just seed the name.
  const [prefilledItemName, setPrefilledItemName] = useState('');
  const handleAddManually = (searchValue: string) => {
    setPrefilledItemName(searchValue);
  };

  // Item created from the details form — refresh suggestions and close the sheet.
  const handleAddDetailsSuccess = () => {
    suggestionsResult.refetch();
    onItemAdded?.();
    onClose();
  };

  // Quick add from the search autocomplete.
  const handleQuickAddSearchSuggestion = async (item: ItemSuggestion) => {
    if (!shoppingListId || adding) return;

    // The toast fires ahead of the result: a queued create has none to wait for.
    toastService.success(
      t(shoppingListSheetConfig.quickAdd.toastMessageKey, { name: item.name }),
    );

    const outcome = await addItem({
      itemId: item.id,
      itemName: item.name,
      unitId: item.defaultUnit?.id,
    });
    if (outcome === 'reverted') {
      toastService.error(t('errors.addItemFailedRetry'));
      return;
    }
    onItemAdded?.();
    tutorial?.notifyItemAdded();
  };

  // Quick add from a suggestion tile, which animates out as it goes.
  const handleQuickAddSuggestion = async (
    shoppingItem: ShoppingListSuggestionItem,
  ) => {
    if (
      !shoppingListId ||
      adding ||
      state.exitingItems.has(shoppingItem.itemId)
    )
      return;

    state.startExitAnimation(shoppingItem.itemId);
    toastService.success(
      t(shoppingListSheetConfig.quickAdd.toastMessageKey, {
        name: shoppingItem.name,
      }),
    );

    const outcome = await addItem({
      itemId: shoppingItem.itemId,
      itemName: shoppingItem.name,
      // `lastUnitId` for a recently deleted row, otherwise the item's default.
      unitId:
        shoppingItem.lastUnitId ?? shoppingItem.defaultUnitId ?? undefined,
    });
    if (outcome === 'reverted') {
      // Put the tile back and correct the toast that already fired.
      state.completeExitAnimation(shoppingItem.itemId);
      toastService.error(t('errors.addItemFailedRetry'));
      return;
    }
    onItemAdded?.();
    tutorial?.notifyItemAdded();
  };

  // Handle exit animation complete
  const handleExitComplete = (itemId: string) => {
    removeSuggestion(itemId);
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
      renderDetails={({ goBack }) => (
        <ShoppingListDetailsStep
          shoppingListId={shoppingListId}
          prefilledItemName={prefilledItemName}
          refetch={suggestionsResult.refetch}
          onClose={goBack}
          onSuccess={handleAddDetailsSuccess}
        />
      )}
    />
  );
};
