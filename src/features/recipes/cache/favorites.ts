import {
  adoptServerEntityId,
  createAddToParentConnectionUpdater,
} from '#/apollo/utils/cacheUpdaters';
import type { ApolloCache, Reference } from '@apollo/client';
import {
  MySavedRecipesDocument,
  SavedRecipeFoldersDocument,
  type SavedRecipeFoldersQuery,
} from '#features/recipes/graphql/recipe.generated';
import {
  Favorites_RecipeFragmentDoc,
  Favorites_RowFragmentDoc,
  Favorites_SavedDetailsFragmentDoc,
} from './favorites.generated';

/** What a save files the recipe under; all optional. */
export interface SaveToFavoritesOptions {
  folder?: string;
  tags?: string[];
  notes?: string;
}

/**
 * Re-points `Recipe.savedDetails` when the server resolves to an EXISTING
 * `SavedRecipe` and evicts the client-id entity. Must run AFTER the server
 * edge roots that row, or gc collects it.
 */
const adoptServerFavoriteId = (
  cache: ApolloCache,
  clientId: string,
  savedRecipeId: string,
  recipeId: string,
): void => {
  const recipeCacheId = cache.identify({ __typename: 'Recipe', id: recipeId });
  if (recipeCacheId) {
    cache.writeFragment({
      id: recipeCacheId,
      fragment: Favorites_SavedDetailsFragmentDoc,
      data: {
        __typename: 'Recipe',
        id: recipeId,
        savedDetails: { __typename: 'SavedRecipe', id: savedRecipeId },
      },
    });
  }
  adoptServerEntityId(cache, 'SavedRecipe', savedRecipeId, clientId);
};

const addToSavedRecipes = createAddToParentConnectionUpdater<{
  __typename: 'SavedRecipe';
  id: string;
}>('User', 'savedRecipesConnection', 'SavedRecipe');

/** The `SavedRecipe` a save's response names, read off the written row. */
export interface SavedFavorite {
  id: string;
  recipeId: string;
  folder: string | null | undefined;
}

/**
 * Settles a save the server answered, in the foreground or on replay: the
 * saved row is listed, its folder offered, and a save the server converged on
 * an existing row moves off the minted one. Running it twice equals once.
 */
export const linkSavedFavorite = (
  cache: ApolloCache,
  saved: SavedFavorite,
  clientId: string | null | undefined,
): void => {
  const me = cache.readQuery({ query: MySavedRecipesDocument })?.me;
  if (me) {
    addToSavedRecipes(
      cache,
      me.id,
      { __typename: 'SavedRecipe', id: saved.id },
      { position: 'end' },
    );
  }

  const { folder } = saved;
  if (folder) {
    cache.updateQuery<SavedRecipeFoldersQuery>(
      { query: SavedRecipeFoldersDocument },
      existing => {
        if (!existing || existing.savedRecipeFolders.includes(folder)) {
          return existing;
        }
        return {
          ...existing,
          savedRecipeFolders: [...existing.savedRecipeFolders, folder],
        };
      },
    );
  }

  // After the server row is listed, so gc does not collect it.
  if (clientId && saved.id !== clientId) {
    adoptServerFavoriteId(cache, clientId, saved.id, saved.recipeId);
  }
};

/**
 * Writes the optimistic favorite and returns its undo. Three writes reverted
 * together: the `SavedRecipe` entity under the client-minted id,
 * `Recipe.savedDetails` pointed at it (the heart), and its `MySavedRecipes`
 * edge (the saved list).
 */
export const writeOptimisticFavorite = (
  cache: ApolloCache,
  savedRecipeId: string,
  recipeId: string,
  saveOptions: SaveToFavoritesOptions | undefined,
): (() => void) => {
  const recipeCacheId = cache.identify({
    __typename: 'Recipe',
    id: recipeId,
  });
  // The already-cached recipe, so the saved row shows it offline. An uncached
  // one gets neutral fields; the post-replay refetch heals them.
  const cachedRecipe = recipeCacheId
    ? cache.readFragment({
        id: recipeCacheId,
        fragment: Favorites_RecipeFragmentDoc,
      })
    : null;
  const now = new Date().toISOString();

  // (a) The whole row, so the edge and savedDetails resolve even fully
  //     offline, where no response ever arrives to materialize it.
  cache.writeFragment({
    id: cache.identify({ __typename: 'SavedRecipe', id: savedRecipeId }),
    fragment: Favorites_RowFragmentDoc,
    fragmentName: 'favorites_row',
    data: {
      __typename: 'SavedRecipe',
      id: savedRecipeId,
      recipeId,
      folder: saveOptions?.folder ?? null,
      tags: saveOptions?.tags ?? [],
      notes: saveOptions?.notes ?? null,
      personalRating: null,
      cookedCount: 0,
      lastCookedAt: null,
      createdAt: now,
      updatedAt: now,
      recipe: cachedRecipe ?? {
        __typename: 'Recipe',
        id: recipeId,
        name: '',
        description: null,
        imageUrl: null,
        servings: 0,
        prepTimeMinutes: null,
        cookTimeMinutes: null,
        totalTimeMinutes: null,
      },
    },
  });

  // (b) Point Recipe.savedDetails at the new SavedRecipe, snapshotting the
  //     previous ref for revert.
  const savedDetailsSnapshot = recipeCacheId
    ? cache.readFragment<{ savedDetails: Reference | null }>({
        id: recipeCacheId,
        fragment: Favorites_SavedDetailsFragmentDoc,
      })?.savedDetails ?? null
    : null;
  if (recipeCacheId) {
    cache.writeFragment({
      id: recipeCacheId,
      fragment: Favorites_SavedDetailsFragmentDoc,
      data: {
        __typename: 'Recipe',
        id: recipeId,
        savedDetails: { __typename: 'SavedRecipe', id: savedRecipeId },
      },
    });
  }

  // (c) List the row first in MySavedRecipes, snapshotting the query for revert.
  const savedRecipesSnapshot = cache.readQuery({
    query: MySavedRecipesDocument,
  });
  if (savedRecipesSnapshot?.me) {
    addToSavedRecipes(cache, savedRecipesSnapshot.me.id, {
      __typename: 'SavedRecipe',
      id: savedRecipeId,
    });
  }

  return () => {
    if (savedRecipesSnapshot) {
      cache.writeQuery({
        query: MySavedRecipesDocument,
        data: savedRecipesSnapshot,
      });
    }
    if (recipeCacheId) {
      cache.modify<{ savedDetails: Reference | null }>({
        id: recipeCacheId,
        fields: { savedDetails: () => savedDetailsSnapshot },
      });
    }
    cache.evict({ id: `SavedRecipe:${savedRecipeId}` });
    cache.gc();
  };
};
