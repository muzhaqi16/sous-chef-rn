import React, { useRef, useState } from 'react';
import { useTranslation } from '#/i18n';
import type { ShoppingListSuggestionItem } from '#features/shoppingList/hooks/useShoppingListSuggestions';
import {
  useShoppingListSuggestions,
  SHOPPING_SUGGESTIONS_LIMIT,
} from '#features/shoppingList/hooks/useShoppingListSuggestions';
import { toastService } from '#/services/toastService';
import { useAddToShoppingList } from '#features/shoppingList/hooks/useAddToShoppingList';
import type { ItemSuggestion } from '#/graphql/generated/schemaTypes';
import { SuggestionSurface } from '#/graphql/generated/schemaTypes';
import { useSuggestionDismissal } from '#features/catalog/hooks/useSuggestionDismissal';
import { useShowShoppingListImages } from '#hooks/settings/useUserPreferences';
import {
  useShoppingListTutorial,
  ShoppingListTutorialStep,
} from '#features/shoppingList/context/ShoppingListTutorialContext';
import { SheetTutorialHint } from '#features/shoppingList/components/SheetTutorialHint';
import { AddItemSheet } from '#features/catalog/ui/AddItemSheet/AddItemSheet';
import { useAddItemSheetState } from '#features/catalog/ui/AddItemSheet/useAddItemSheetState';
import { shoppingListSheetConfig } from '#features/shoppingList/components/AddToShoppingListSheet/shoppingListSheetConfig';
import { ShoppingListDetailsStep } from './ShoppingListDetailsStep';

interface AddToShoppingListSheetProps {
  visible: boolean;
  /** `details` opens on the form, for the + menu's "Add manually". */
  startStep?: 'search' | 'details';
  shoppingListId: string | undefined;
  onClose: () => void;
  /** Initial search query to pre-populate when sheet opens */
  initialSearchQuery?: string;
  /** Called when an item is successfully added */
  onItemAdded?: () => void;
}

export const AddToShoppingListSheet: React.FC<AddToShoppingListSheetProps> = ({
  visible,
  startStep,
  shoppingListId,
  onClose,
  initialSearchQuery = '',
  onItemAdded,
}) => {
  const { t } = useTranslation();
  const { addItem, removeSuggestion, restoreSuggestion } = useAddToShoppingList(
    {
      shoppingListId,
      suggestionsLimit: SHOPPING_SUGGESTIONS_LIMIT,
    },
  );
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

  // Dismiss a junk/unwanted suggestion from the SHOPPING surface.
  const { dismissSuggestion } = useSuggestionDismissal(
    SuggestionSurface.Shopping,
    { remove: removeSuggestion, restore: restoreSuggestion },
  );

  // Items whose add is in flight: a second tap on the same one is dropped, a
  // tap on another goes ahead.
  const pendingItemIds = useRef(new Set<string>());

  // Keep the sheet "open" across the barcode navigation so the user lands
  // back on it if they cancel. useStandardBottomSheet dismisses the underlying
  // BottomSheetModal when the screen blurs but preserves `visible`, so its
  // focus effect re-presents the sheet on return. Calling onClose() here would
  // flip `visible` to false before the blur, so the sheet would stay closed on
  // return instead of restoring.
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

  /**
   * Adds one catalog item, taking it off the suggestion lists at once. The
   * toast fires ahead of the result: a queued create has none to wait for.
   */
  const quickAdd = async (item: {
    itemId: string;
    name: string;
    unitId: string | undefined;
  }) => {
    if (!shoppingListId || pendingItemIds.current.has(item.itemId)) return;
    pendingItemIds.current.add(item.itemId);
    const removal = removeSuggestion(item.itemId);
    toastService.success(
      t(shoppingListSheetConfig.quickAdd.toastMessageKey, { name: item.name }),
    );

    const outcome = await addItem({
      itemId: item.itemId,
      itemName: item.name,
      unitId: item.unitId,
    });
    pendingItemIds.current.delete(item.itemId);
    if (outcome === 'reverted') {
      // Put the tile back and correct the toast that already fired.
      restoreSuggestion(removal);
      toastService.error(t('errors.addItemFailedRetry'));
      return;
    }
    onItemAdded?.();
    tutorial?.notifyItemAdded();
  };

  const handleQuickAddSearchSuggestion = (item: ItemSuggestion) =>
    quickAdd({
      itemId: item.id,
      name: item.name,
      unitId: item.defaultUnit?.id,
    });

  const handleQuickAddSuggestion = (shoppingItem: ShoppingListSuggestionItem) =>
    quickAdd({
      itemId: shoppingItem.itemId,
      name: shoppingItem.name,
      // The API's one-tap unit: an Add Again row's own unit, else the item's.
      unitId: shoppingItem.defaultUnitId ?? undefined,
    });

  const handleDismissSuggestion = (item: ShoppingListSuggestionItem) => {
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
            suggestionsResult.state === 'ready'
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
      suggestions={suggestionsResult}
      onQuickAddSearchSuggestion={handleQuickAddSearchSuggestion}
      onQuickAddSuggestion={handleQuickAddSuggestion}
      onDismissSuggestion={handleDismissSuggestion}
      onAddManually={handleAddManually}
      startStep={startStep}
      shouldFetch={state.shouldFetch}
      initialSearchQuery={initialSearchQuery}
      showImages={showImages}
      tutorialHint={tutorialHintElement}
      renderDetails={({ goBack }) => (
        <ShoppingListDetailsStep
          shoppingListId={shoppingListId}
          prefilledItemName={prefilledItemName}
          onClose={goBack}
          onSuccess={handleAddDetailsSuccess}
        />
      )}
    />
  );
};
