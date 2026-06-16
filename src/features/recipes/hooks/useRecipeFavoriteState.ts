import { useState, useEffect } from 'react';
import { errorService } from '#/services/errorService';
import { useApolloClient, useQuery } from '@apollo/client/react';
import type { RecipeInformation } from '#/services/recipeApi/types';
import { MyRecipesDocument } from '#features/recipes/graphql/recipe.generated';
import {
  UseRecipeFavoriteState_RecipeFragmentDoc,
  type UseRecipeFavoriteState_RecipeFragment,
} from './useRecipeFavoriteState.generated';
import { type MaterializedRecipe } from '#features/recipes/hooks/useRecipeData';
import { extractNodes } from '#/utils/connectionUtils';
import { executeWithLoadingState } from '#/utils/compilerSafeWrappers';
import type {
  SaveToFavoritesOptions,
  UseRecipePreloadReturn,
} from '#features/recipes/hooks/useRecipePreload';

export interface UseRecipeFavoriteStateParams {
  externalSource: string | undefined;
  externalId: string | undefined;
  externalRecipe: RecipeInformation | null;
  isBackendRecipe: boolean;
  backendRecipe: MaterializedRecipe | undefined;
  /** From `useRecipePreload`. */
  saveRecipeToFavorites: UseRecipePreloadReturn['saveRecipeToFavorites'];
  /** From `useRecipePreload`. */
  savingToFavorites: boolean;
}

export interface UseRecipeFavoriteStateResult {
  isSaved: boolean;
  saving: boolean;
  savedFolderLocal: string | null;
  handleSaveRecipe: (
    folder?: string | null,
    tags?: string[],
    notes?: string,
  ) => void;
  /** Exposed so the orchestrator can wire onUnfavoriteSuccess + onFavoriteSuccess. */
  setRecipeSaved: (v: boolean) => void;
  setSavedFolderLocal: (v: string | null) => void;
}

function syncSavedRecipeState(
  derivedSaved: boolean,
  derivedFolder: string | null,
  setRecipeSaved: (v: boolean) => void,
  setSavedFolderLocal: (v: string | null) => void,
): void {
  setRecipeSaved(derivedSaved);
  setSavedFolderLocal(derivedSaved ? derivedFolder : null);
}

/**
 * Tracks whether the current recipe is in the user's favorites and provides
 * `handleSaveRecipe` for external recipes. Backend recipes derive `isSaved`
 * directly from `backendRecipe.savedDetails`; external recipes look themselves
 * up in `MyRecipes` and mirror the result into local state.
 */
export function useRecipeFavoriteState({
  externalSource,
  externalId,
  externalRecipe,
  isBackendRecipe,
  backendRecipe,
  saveRecipeToFavorites,
  savingToFavorites,
}: UseRecipeFavoriteStateParams): UseRecipeFavoriteStateResult {
  const apolloClient = useApolloClient();
  const [saving, setSaving] = useState(false);
  const [recipeSaved, setRecipeSaved] = useState(false);
  const [savedFolderLocal, setSavedFolderLocal] = useState<string | null>(null);

  const { data: myRecipesData } = useQuery(MyRecipesDocument, {
    skip: !externalSource || !externalId,
  });

  const savedRecipesList = extractNodes(myRecipesData?.recipes);

  // Materialize each recipe ref via a narrow fragment that reads only the
  // fields needed to identify a saved external recipe and surface its folder.
  const savedRecipeMatch =
    externalSource && externalId && savedRecipesList.length > 0
      ? savedRecipesList
          .map(ref =>
            apolloClient.cache.readFragment<UseRecipeFavoriteState_RecipeFragment>(
              {
                fragment: UseRecipeFavoriteState_RecipeFragmentDoc,
                fragmentName: 'useRecipeFavoriteState_recipe',
                from: { __typename: 'Recipe', id: ref.id },
              },
            ),
          )
          .find(
            r =>
              r?.externalSource === externalSource &&
              r?.externalId === externalId,
          )
      : undefined;

  const derivedRecipeSaved = !!savedRecipeMatch;
  const derivedSavedFolderLocal =
    savedRecipeMatch?.savedDetails?.folder ?? null;

  useEffect(() => {
    syncSavedRecipeState(
      derivedRecipeSaved,
      derivedSavedFolderLocal,
      setRecipeSaved,
      setSavedFolderLocal,
    );
  }, [derivedRecipeSaved, derivedSavedFolderLocal]);

  const isSaved = isBackendRecipe ? !!backendRecipe?.savedDetails : recipeSaved;

  const handleSaveRecipe = (
    folder?: string | null,
    tags?: string[],
    notes?: string,
  ) => {
    if (!externalRecipe || !externalSource || !externalId) return;

    const options: SaveToFavoritesOptions = {
      folder: folder ?? undefined,
      tags: tags && tags.length > 0 ? tags : undefined,
      notes: notes || undefined,
    };

    executeWithLoadingState(
      async () => {
        const result = await saveRecipeToFavorites(externalRecipe, options);

        if (result.success) {
          setRecipeSaved(true);
          setSavedFolderLocal(folder ?? null);
        }
      },
      setSaving,
      err => errorService.reportError(err, { operation: 'saveRecipe' }),
    );
  };

  return {
    isSaved,
    saving: saving || savingToFavorites,
    savedFolderLocal,
    handleSaveRecipe,
    setRecipeSaved,
    setSavedFolderLocal,
  };
}
