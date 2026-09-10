import { adoptServerEntityId } from '#/apollo/utils/cacheUpdaters';
import { gql, type Reference } from '@apollo/client';
import {
  MySavedRecipesDocument,
  type MySavedRecipesQuery,
} from '#features/recipes/graphql/recipe.generated';
import type { SavedRecipeCard_SavedRecipeFragment } from '#features/recipes/components/SavedRecipeCard.generated';
import type { ApolloCache } from '@apollo/client';
import type { SaveToFavoritesOptions } from '#features/recipes/hooks/useRecipePreload';

const OptimisticSavedRecipeFragment = gql`
  fragment _OptimisticSavedRecipe on SavedRecipe {
    id
    folder
    tags
    notes
    personalRating
    cookedCount
    lastCookedAt
    createdAt
    updatedAt
    recipe {
      id
    }
  }
`;

/** Shape written by {@link OptimisticSavedRecipeFragment}. */
type OptimisticSavedRecipe = {
  __typename: 'SavedRecipe';
  id: string;
  folder: string | null;
  tags: string[];
  notes: string | null;
  personalRating: number | null;
  cookedCount: number;
  lastCookedAt: string | null;
  createdAt: string;
  updatedAt: string;
  recipe: { __typename: 'Recipe'; id: string };
};

/**
 * Recipe display fields the saved-list card renders (the
 * `SavedRecipeCard_savedRecipe → recipe` selection). Read from the already-cached
 * `Recipe` entity so the optimistic `MySavedRecipes` edge node is complete and
 * the card doesn't blank offline.
 */
const SavedRecipeCardRecipeFragment = gql`
  fragment _SavedRecipeCardRecipe on Recipe {
    id
    name
    description
    imageUrl
    servings
    prepTimeMinutes
    cookTimeMinutes
    totalTimeMinutes
  }
`;

/**
 * Writes / reads `Recipe.savedDetails` for the optimistic favorite (and its
 * revert snapshot). writeFragment is used instead of cache.modify because a
 * freshly-upserted Recipe has no `savedDetails` field yet, and cache.modify
 * only fires a modifier for a field that already exists on the entity.
 */
const RecipeSavedDetailsFragment = gql`
  fragment _RecipeSavedDetails on Recipe {
    id
    savedDetails {
      id
    }
  }
`;

/** The `recipe` node the saved-list card renders. */
type SavedRecipeCardRecipe = SavedRecipeCard_SavedRecipeFragment['recipe'];

/**
 * The `MySavedRecipes` edge node — Apollo's `updateQuery` deep-resolves
 * fragments, so this is the UNMASKED `SavedRecipe`: the query's inline
 * `createdAt`/`updatedAt` plus every `SavedRecipeCard_savedRecipe` field.
 */
type SavedRecipeEdgeNode = Omit<
  SavedRecipeCard_SavedRecipeFragment,
  ' $fragmentName'
> & { createdAt: string; updatedAt: string };

/**
 * Re-points `Recipe.savedDetails` when the server resolves to an EXISTING
 * `SavedRecipe` and evicts the client-id entity. Must run AFTER the server
 * edge roots that row, or gc collects it.
 */
export const adoptServerFavoriteId = (
  cache: ApolloCache,
  clientId: string,
  savedRecipeId: string,
  recipeId: string,
): void => {
  const recipeCacheId = cache.identify({ __typename: 'Recipe', id: recipeId });
  if (recipeCacheId) {
    cache.writeFragment({
      id: recipeCacheId,
      fragment: RecipeSavedDetailsFragment,
      fragmentName: '_RecipeSavedDetails',
      data: {
        __typename: 'Recipe',
        id: recipeId,
        savedDetails: { __typename: 'SavedRecipe', id: savedRecipeId },
      },
    });
  }
  adoptServerEntityId(cache, 'SavedRecipe', savedRecipeId, clientId);
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
  const now = new Date().toISOString();
  const optimisticSavedRecipe: OptimisticSavedRecipe = {
    __typename: 'SavedRecipe',
    id: savedRecipeId,
    folder: saveOptions?.folder ?? null,
    tags: saveOptions?.tags ?? [],
    notes: saveOptions?.notes ?? null,
    personalRating: null,
    cookedCount: 0,
    lastCookedAt: null,
    createdAt: now,
    updatedAt: now,
    recipe: { __typename: 'Recipe', id: recipeId },
  };

  // (a) Write the full entity so the (bare-ref) edge and savedDetails resolve
  //     even fully offline, where no response ever arrives to materialize it.
  cache.writeFragment({
    id: cache.identify(optimisticSavedRecipe),
    fragment: OptimisticSavedRecipeFragment,
    fragmentName: '_OptimisticSavedRecipe',
    data: optimisticSavedRecipe,
  });

  // (b) Point Recipe.savedDetails at the new SavedRecipe (snapshot the
  //     previous ref for revert). Use writeFragment, not cache.modify — a
  //     freshly-upserted Recipe has no `savedDetails` field yet, and
  //     cache.modify only fires a modifier for a field that already exists.
  const recipeCacheId = cache.identify({
    __typename: 'Recipe',
    id: recipeId,
  });
  const savedDetailsSnapshot = recipeCacheId
    ? cache.readFragment<{ savedDetails: Reference | null }>({
        id: recipeCacheId,
        fragment: RecipeSavedDetailsFragment,
        fragmentName: '_RecipeSavedDetails',
      })?.savedDetails ?? null
    : null;
  if (recipeCacheId) {
    cache.writeFragment({
      id: recipeCacheId,
      fragment: RecipeSavedDetailsFragment,
      fragmentName: '_RecipeSavedDetails',
      data: {
        __typename: 'Recipe',
        id: recipeId,
        savedDetails: { __typename: 'SavedRecipe', id: savedRecipeId },
      },
    });
  }

  // (c) Add a MySavedRecipes edge (snapshot the query first for revert).
  //     Read the recipe display fields from the already-cached Recipe so the
  //     saved-list card renders complete offline. Fall back to an id-only
  //     recipe when the Recipe entity isn't cached yet — the post-replay
  //     refetch heals the gap.
  const cachedRecipe = recipeCacheId
    ? cache.readFragment<SavedRecipeCardRecipe>({
        id: recipeCacheId,
        fragment: SavedRecipeCardRecipeFragment,
        fragmentName: '_SavedRecipeCardRecipe',
      })
    : null;
  const edgeRecipe: SavedRecipeCardRecipe = cachedRecipe ?? {
    __typename: 'Recipe',
    id: recipeId,
    name: '',
    description: null,
    imageUrl: null,
    servings: 0,
    prepTimeMinutes: null,
    cookTimeMinutes: null,
    totalTimeMinutes: null,
  };

  const savedRecipesSnapshot = cache.readQuery<MySavedRecipesQuery>({
    query: MySavedRecipesDocument,
  });
  cache.updateQuery<MySavedRecipesQuery>(
    { query: MySavedRecipesDocument },
    existing => {
      if (!existing?.me) return existing;
      // Guard against a duplicate edge for the same SavedRecipe id.
      const alreadyEdged = existing.me.savedRecipesConnection.edges.some(
        edge => edge.node.id === savedRecipeId,
      );
      if (alreadyEdged) return existing;
      const node: SavedRecipeEdgeNode = {
        __typename: 'SavedRecipe',
        id: savedRecipeId,
        folder: optimisticSavedRecipe.folder,
        tags: optimisticSavedRecipe.tags,
        notes: optimisticSavedRecipe.notes,
        personalRating: optimisticSavedRecipe.personalRating,
        cookedCount: optimisticSavedRecipe.cookedCount,
        lastCookedAt: optimisticSavedRecipe.lastCookedAt,
        createdAt: optimisticSavedRecipe.createdAt,
        updatedAt: optimisticSavedRecipe.updatedAt,
        recipe: edgeRecipe,
      };
      const newEdge: {
        __typename: 'SavedRecipeEdge';
        cursor: string;
        node: SavedRecipeEdgeNode;
      } = {
        __typename: 'SavedRecipeEdge',
        cursor: savedRecipeId,
        node,
      };
      return {
        ...existing,
        me: {
          ...existing.me,
          savedRecipesConnection: {
            ...existing.me.savedRecipesConnection,
            edges: [newEdge, ...existing.me.savedRecipesConnection.edges],
            totalCount:
              (existing.me.savedRecipesConnection.totalCount ?? 0) + 1,
          },
        },
      };
    },
  );

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
