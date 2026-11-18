import { useEffect, useRef, useState } from 'react';
import { useRoute } from '@react-navigation/native';
import { useNavigationIntents } from '#platform/screen';
import { executeRefreshWithFinally } from '#/utils/finallyHelpers';
import { sleep } from '#/utils/backoff';
import { catalogKey } from '#domain/catalogRecipes';
import { useOpenedRecipeId } from '#features/recipes/store/openedCatalogRecipes';
import { useRecipeData } from '../../hooks/useRecipeData';
import { useRecipeFavoriteState } from '../../hooks/useRecipeFavoriteState';
import { useRecipeSavedMetadata } from '../../hooks/useRecipeSavedMetadata';
import { useRecipeShoppingList } from '../../hooks/useRecipeShoppingList';
import { useRecipeCookingActions } from '../../hooks/useRecipeCookingActions';
import {
  useOpenCatalogRecipe,
  type CatalogRecipeHint,
  type OpenedCatalogRecipe,
} from '../../hooks/useOpenCatalogRecipe';

// A save asks the API to fetch what a catalog recipe lacks, and nothing
// announces when that lands, so the recipe is read again after each of these.
const RECHECK_AFTER_SAVE_MS = [3000, 10000];

// A local read settles in tens of milliseconds, too fast for the spinner to
// register as the pull having done anything.
const MIN_REFRESH_MS = 500;

const hintKey = (hint: CatalogRecipeHint): string =>
  catalogKey({ provider: hint.provider, providerRecipeId: hint.externalId });

const failureOf = (
  hint: CatalogRecipeHint,
  result: OpenedCatalogRecipe,
): { key: string; failure: string } | null =>
  result.opened ? null : { key: hintKey(hint), failure: result.failure };

/**
 * Opens a catalog hint, once per recipe. An open records the recipe's id in
 * the opened-recipes store, which the screen reads, so only a failure is kept.
 */
function useCatalogOpen(hint: CatalogRecipeHint | undefined) {
  const { openCatalogRecipe } = useOpenCatalogRecipe();
  const [failed, setFailed] = useState<{ key: string; failure: string } | null>(
    null,
  );

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
      if (current) setFailed(failureOf(hint, result));
    });
    return () => {
      current = false;
    };
  }, [hint]);

  // A pull asks again.
  const reopen = async () => {
    if (!hint) return;
    setFailed(failureOf(hint, await openRef.current(hint)));
  };

  return {
    failure:
      failed && hint && failed.key === hintKey(hint) ? failed.failure : null,
    reopen,
  };
}

/**
 * Orchestrator that composes the recipe-detail sub-hooks. Each sub-hook owns
 * a narrow concern; this hook just wires them together for the screen.
 */
export function useRecipeDetail() {
  const {
    recipeId: routeRecipeId,
    row,
    catalog,
  } = useRoute('RecipeDetail').params;
  const { goBack } = useNavigationIntents();

  const catalogHint = routeRecipeId ? undefined : catalog;
  const catalogOpen = useCatalogOpen(catalogHint);
  const openedRecipeId = useOpenedRecipeId(catalogHint);
  const recipeId = routeRecipeId ?? openedRecipeId;

  const cookingActions = useRecipeCookingActions({ recipeId });

  const data = useRecipeData({
    recipeId,
    hint: catalog ?? row,
    // Once a recipe is known, a failed open (a pull's included) leaves it shown.
    openFailure: recipeId ? null : catalogOpen.failure,
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

  // Only an open makes the API fetch a catalog recipe it lacks; a read returns
  // the same stub. So a pull opens again until the recipe is complete.
  const details = data.displayData?.details;
  const awaitsFetch = details === 'pending' || details === 'unavailable';
  const refreshRecipe = () =>
    !recipeId || (catalogHint && awaitsFetch)
      ? catalogOpen.reopen()
      : refetchRecipe();

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = () => {
    void executeRefreshWithFinally(
      () => Promise.all([refreshRecipe(), sleep(MIN_REFRESH_MS)]),
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
    lastCookedAt: data.backendRecipe?.savedDetails?.lastCookedAt ?? null,

    // Unfavorite
    handleUnfavoriteRecipe: savedMetadata.handleUnfavoriteRecipe,
  };
}
