import {
  adoptServerEntityId,
  createAddToParentConnectionUpdater,
  type ConnectionData,
} from '#/apollo/utils/cacheUpdaters';
import type { ApolloCache, Reference } from '@apollo/client';
import type { ModifierDetails } from '@apollo/client/cache';
import {
  SavedRecipeFoldersDocument,
  type SavedRecipeFoldersQuery,
} from '#features/recipes/graphql/recipe.generated';
import { writeLocalEntity } from '#/apollo/utils/writeLocalEntity';
import {
  Favorites_RowFragmentDoc,
  Favorites_SavedDetailsFragmentDoc,
  FavoritesViewerDocument,
} from './favorites.generated';
import {
  NEUTRAL_LOCAL_SAVED_RECIPE,
  NEUTRAL_LOCAL_SAVED_RECIPE_BY_TYPE,
} from './savedRecipeRowNeutral.generated';

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

/** The saved list as the cache stores it: `null` where the server said so. */
type StoredList = ConnectionData | null | undefined;

/** The signed-in user's id, once anything has cached `me`. */
export const readViewerId = (cache: ApolloCache): string | null =>
  cache.readQuery({ query: FavoritesViewerDocument, optimistic: true })?.me
    ?.id ?? null;

/** Offers a folder a saved recipe now sits in. */
export const offerSavedFolder = (cache: ApolloCache, folder: string): void => {
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
};

/** The `SavedRecipe` a save's response names, read off the written row. */
export interface SavedFavorite {
  id: string;
  recipeId: string;
  folder: string | null | undefined;
}

/**
 * Settles a save the server answered: the saved row is listed, its folder
 * offered, and a save the server converged on an existing row moves off the
 * minted one.
 */
export const linkSavedFavorite = (
  cache: ApolloCache,
  saved: SavedFavorite,
  clientId: string | null | undefined,
): void => {
  const viewerId = readViewerId(cache);
  if (viewerId) {
    addToSavedRecipes(cache, viewerId, {
      __typename: 'SavedRecipe',
      id: saved.id,
    });
  }

  if (saved.folder) offerSavedFolder(cache, saved.folder);

  // After the server row is listed, so gc does not collect it.
  if (clientId && saved.id !== clientId) {
    adoptServerFavoriteId(cache, clientId, saved.id, saved.recipeId);
  }
};

/**
 * Writes a local favorite: the `SavedRecipe` under its minted id, whole so the
 * edge and `savedDetails` resolve fully offline, `Recipe.savedDetails` pointed
 * at it (the heart), and its `MySavedRecipes` edge (the saved list). The recipe
 * is the cached one; an uncached one gets neutral fields until a refetch.
 */
export const writeLocalFavorite = (
  cache: ApolloCache,
  savedRecipeId: string,
  recipeId: string,
  saveOptions: SaveToFavoritesOptions | undefined,
  now: string,
): void => {
  const recipeCacheId = cache.identify({
    __typename: 'Recipe',
    id: recipeId,
  });

  writeLocalEntity(cache, {
    fragment: Favorites_RowFragmentDoc,
    fragmentName: 'favorites_row',
    neutral: NEUTRAL_LOCAL_SAVED_RECIPE,
    neutralByType: NEUTRAL_LOCAL_SAVED_RECIPE_BY_TYPE,
    known: {
      __typename: 'SavedRecipe',
      id: savedRecipeId,
      recipeId,
      folder: saveOptions?.folder ?? null,
      tags: saveOptions?.tags ?? [],
      notes: saveOptions?.notes ?? null,
      createdAt: now,
      updatedAt: now,
      recipe: { __typename: 'Recipe', id: recipeId },
    },
  });

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

  const viewerId = readViewerId(cache);
  if (viewerId) {
    addToSavedRecipes(cache, viewerId, {
      __typename: 'SavedRecipe',
      id: savedRecipeId,
    });
  }
};

/**
 * Drops a recipe's saved edge from every cached variant of the list and clears
 * `Recipe.savedDetails`. A held total falls by one whether or not the edge is
 * in a loaded page: the server's count does. One never held stays absent, or
 * the next query selecting it would read a made-up count as a cache hit.
 */
export const dropFavorite = (cache: ApolloCache, recipeId: string): void => {
  const viewerId = readViewerId(cache);
  const viewerCacheId = viewerId
    ? cache.identify({ __typename: 'User', id: viewerId })
    : undefined;
  if (viewerCacheId) {
    cache.modify({
      id: viewerCacheId,
      fields: {
        savedRecipesConnection: (
          existing: StoredList,
          { readField }: ModifierDetails,
        ) => {
          if (!existing) return existing;
          const { totalCount } = existing;
          return {
            ...existing,
            edges: (existing.edges ?? []).filter(
              edge => readField('recipeId', edge.node) !== recipeId,
            ),
            ...(typeof totalCount === 'number' && {
              totalCount: Math.max(0, totalCount - 1),
            }),
          };
        },
      },
    });
  }
  const recipeCacheId = cache.identify({ __typename: 'Recipe', id: recipeId });
  if (recipeCacheId) {
    cache.modify<{ savedDetails: Reference | null }>({
      id: recipeCacheId,
      fields: { savedDetails: () => null },
    });
  }
};
