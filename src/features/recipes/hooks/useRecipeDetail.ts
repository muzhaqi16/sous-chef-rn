import { useEffect, useRef, useState } from 'react';
import { useRoute } from '@react-navigation/native';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { executeRefreshWithFinally } from '#/utils/finallyHelpers';
import { useRecipeData } from './useRecipeData';
import { useRecipeFavoriteState } from './useRecipeFavoriteState';
import { useRecipeSavedMetadata } from './useRecipeSavedMetadata';
import { useRecipeShoppingList } from './useRecipeShoppingList';
import { useRecipeCookingActions } from './useRecipeCookingActions';
import {
  useOpenCatalogRecipe,
  type CatalogRecipeHint,
  type OpenedCatalogRecipe,
} from './useOpenCatalogRecipe';

// A save asks the API to fetch what a catalog recipe lacks, and nothing
// announces when that lands, so the recipe is read again after each of these.
const RECHECK_AFTER_SAVE_MS = [3000, 10000];

// A local read settles in tens of milliseconds, too fast for the spinner to
// register as the pull having done anything.
const MIN_REFRESH_MS = 500;
const wait = (ms: number) =>
  new Promise<void>(resolve => {
    setTimeout(resolve, ms);
  });

/** The backend id behind a catalog hint, opened once per recipe. */
function useOpenedCatalogRecipe(hint: CatalogRecipeHint | undefined) {
  const { openCatalogRecipe } = useOpenCatalogRecipe();
  const [opened, setOpened] = useState<{
    externalId: string;
    result: OpenedCatalogRecipe;
  } | null>(null);

  // Through a ref, so the effect keys on the recipe alone and cannot re-fire
  // the mutation on a render that only rebuilt the function.
  const openRef = useRef(openCatalogRecipe);
  useEffect(() => {
    openRef.current = openCatalogRecipe;
  });

  useEffect(() => {
    if (!hint) return;
    let current = true;
    void openRef.current(hint).then(result => {
      if (current) setOpened({ externalId: hint.externalId, result });
    });
    return () => {
      current = false;
    };
  }, [hint]);

  // A pull after a failed open asks again.
  const reopen = async () => {
    if (!hint) return;
    const result = await openRef.current(hint);
    setOpened({ externalId: hint.externalId, result });
  };

  return {
    result:
      opened && hint && opened.externalId === hint.externalId
        ? opened.result
        : null,
    reopen,
  };
}

/**
 * Orchestrator that composes the recipe-detail sub-hooks. Each sub-hook owns
 * a narrow concern; this hook just wires them together for the screen.
 */
export function useRecipeDetail() {
  const { recipeId: routeRecipeId, catalog } = useRoute('RecipeDetail').params;
  const { goBack } = useAppNavigation();

  const catalogOpen = useOpenedCatalogRecipe(
    routeRecipeId ? undefined : catalog,
  );
  const opened = catalogOpen.result;
  const recipeId =
    routeRecipeId ?? (opened?.opened ? opened.recipeId : undefined);

  const cookingActions = useRecipeCookingActions({ recipeId });

  const data = useRecipeData({
    recipeId,
    hint: catalog,
    openFailure: opened && !opened.opened ? opened.failure : null,
  });

  const recheckTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(
    () => () => {
      recheckTimers.current.forEach(clearTimeout);
    },
    [],
  );
  const isCatalogRecipe = !!data.backendRecipe?.isExternal;
  const refetchRecipe = data.refetch;
  const favorites = useRecipeFavoriteState({
    backendRecipe: data.backendRecipe,
    onSaved: () => {
      if (!isCatalogRecipe) return;
      recheckTimers.current.push(
        ...RECHECK_AFTER_SAVE_MS.map(delay =>
          setTimeout(() => {
            void refetchRecipe();
          }, delay),
        ),
      );
    },
  });

  // Pull to refresh reads the recipe again, or retries an open that failed.
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = () => {
    void executeRefreshWithFinally(
      () =>
        Promise.all([
          recipeId ? refetchRecipe() : catalogOpen.reopen(),
          wait(MIN_REFRESH_MS),
        ]),
      setRefreshing,
    );
  };

  const shoppingList = useRecipeShoppingList({
    recipeId,
    backendRecipe: data.backendRecipe,
  });

  const savedMetadata = useRecipeSavedMetadata({ recipeId });

  return {
    // Navigation
    goBack,
    recipeId,
    /** Keys the hero's shared transition from the row that opened it. */
    catalogExternalId: catalog?.externalId,

    // Loading/error states
    loading: data.loading,
    error: data.error,
    refreshing,
    handleRefresh,

    // Recipe data
    displayData: data.displayData,
    backendRecipe: data.backendRecipe,

    // Save state
    saving: favorites.saving,
    isSaved: favorites.isSaved,
    handleSaveRecipe: favorites.handleSaveRecipe,

    // Shopping list (state + handlers + sheet refs)
    ...shoppingList,

    // Mark as cooked + ingredient matching
    ...cookingActions,

    // Folder/tag editing
    showFolderPicker: savedMetadata.showFolderPicker,
    setShowFolderPicker: savedMetadata.setShowFolderPicker,
    updatingFolderTags: savedMetadata.updatingFolderTags,
    handleUpdateFolder: savedMetadata.handleUpdateFolder,
    handleUpdateTags: savedMetadata.handleUpdateTags,
    handleUpdateNotes: savedMetadata.handleUpdateNotes,
    handleUpdateRating: savedMetadata.handleUpdateRating,
    savedFolder: data.backendRecipe?.savedDetails?.folder ?? null,
    savedTags: data.backendRecipe?.savedDetails?.tags ?? [],
    savedNotes: data.backendRecipe?.savedDetails?.notes ?? null,
    savedRating: data.backendRecipe?.savedDetails?.personalRating ?? null,
    cookedCount: data.backendRecipe?.savedDetails?.cookedCount ?? 0,

    // Unfavorite
    handleUnfavoriteRecipe: savedMetadata.handleUnfavoriteRecipe,
  };
}
