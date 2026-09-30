import { gql, type InMemoryCache } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import {
  MySavedRecipesDocument,
  SavedRecipeFoldersDocument,
  type MySavedRecipesQuery,
} from '#features/recipes/graphql/recipe.generated';
import { writeLocalFavorite } from '#features/recipes/cache/favorites';
import { reconcileAddRecipeToFavoritesReplay } from '../replayReconcilers';

const MINTED_ID = 'minted-saved-1';
const SERVER_ID = 'server-saved-1';
const RECIPE_ID = 'recipe-1';

const SAVED_DETAILS = gql`
  fragment _ReplayTestSavedDetails on Recipe {
    id
    savedDetails {
      id
    }
  }
`;

// What the replay's own result writes for the row the server kept: the node
// `MySavedRecipes` reads.
const SERVER_ROW = gql`
  fragment _ReplayTestServerRow on SavedRecipe {
    id
    recipeId
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
      name
      description
      imageUrl
      servings
      prepTimeMinutes
      cookTimeMinutes
      totalTimeMinutes
    }
  }
`;

const ID_ONLY = gql`
  fragment _ReplayTestIdOnly on SavedRecipe {
    id
  }
`;

function seed(): InMemoryCache {
  const cache = makeCache();
  cache.writeQuery<MySavedRecipesQuery>({
    query: MySavedRecipesDocument,
    data: {
      __typename: 'Query',
      me: {
        __typename: 'User',
        id: 'user-1',
        savedRecipesConnection: {
          __typename: 'SavedRecipeConnection',
          totalCount: 0,
          edges: [],
          pageInfo: {
            __typename: 'PageInfo',
            hasNextPage: false,
            endCursor: null,
          },
        },
      },
    },
  });
  cache.writeQuery({
    query: SavedRecipeFoldersDocument,
    data: { __typename: 'Query', savedRecipeFolders: [] },
  });
  // Saved offline: the minted row, the heart and the list edge.
  writeLocalFavorite(cache, MINTED_ID, RECIPE_ID, { folder: 'Dinner' });
  return cache;
}

function writeServerRow(cache: InMemoryCache, id: string) {
  cache.writeFragment({
    id: cache.identify({ __typename: 'SavedRecipe', id }),
    fragment: SERVER_ROW,
    data: {
      __typename: 'SavedRecipe',
      id,
      recipeId: RECIPE_ID,
      folder: 'Dinner',
      tags: [],
      notes: null,
      personalRating: null,
      cookedCount: 0,
      lastCookedAt: null,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
      recipe: {
        __typename: 'Recipe',
        id: RECIPE_ID,
        name: 'Soup',
        description: null,
        imageUrl: null,
        servings: 2,
        prepTimeMinutes: null,
        cookTimeMinutes: null,
        totalTimeMinutes: null,
      },
    },
  });
}

const replay = (cache: InMemoryCache, savedId: string) =>
  reconcileAddRecipeToFavoritesReplay(
    cache,
    { input: { id: MINTED_ID, recipeId: RECIPE_ID, folder: 'Dinner' } },
    {
      addRecipeToFavorites: {
        __typename: 'AddRecipeToFavoritesPayload',
        savedRecipe: {
          __typename: 'SavedRecipe',
          id: savedId,
          recipeId: RECIPE_ID,
          folder: 'Dinner',
        },
      },
    },
  );

const savedList = (cache: InMemoryCache) => {
  const connection = cache.readQuery({ query: MySavedRecipesDocument })?.me
    ?.savedRecipesConnection;
  return {
    ids: connection?.edges.map(edge => edge.node.id),
    totalCount: connection?.totalCount,
  };
};

const heart = (cache: InMemoryCache) =>
  cache.readFragment<{ savedDetails: { id: string } | null }>({
    id: cache.identify({ __typename: 'Recipe', id: RECIPE_ID }),
    fragment: SAVED_DETAILS,
  })?.savedDetails?.id;

const isHeldRow = (cache: InMemoryCache, id: string) =>
  cache.readFragment({
    id: cache.identify({ __typename: 'SavedRecipe', id }),
    fragment: ID_ONLY,
  }) !== null;

describe('reconcileAddRecipeToFavoritesReplay', () => {
  it('moves a save the server converged on an existing row onto that row', () => {
    const cache = seed();
    writeServerRow(cache, SERVER_ID);

    replay(cache, SERVER_ID);

    expect(savedList(cache)).toEqual({ ids: [SERVER_ID], totalCount: 1 });
    expect(heart(cache)).toBe(SERVER_ID);
    expect(isHeldRow(cache, MINTED_ID)).toBe(false);
    expect(
      cache.readQuery({ query: SavedRecipeFoldersDocument })
        ?.savedRecipeFolders,
    ).toEqual(['Dinner']);
  });

  it('equals a single application when it runs again', () => {
    const cache = seed();
    writeServerRow(cache, SERVER_ID);

    replay(cache, SERVER_ID);
    const once = cache.extract();
    replay(cache, SERVER_ID);

    expect(cache.extract()).toEqual(once);
    expect(savedList(cache)).toEqual({ ids: [SERVER_ID], totalCount: 1 });
  });

  it('leaves a save the server kept under the minted id as it was', () => {
    const cache = seed();
    writeServerRow(cache, MINTED_ID);

    replay(cache, MINTED_ID);

    expect(savedList(cache)).toEqual({ ids: [MINTED_ID], totalCount: 1 });
    expect(heart(cache)).toBe(MINTED_ID);
  });

  it('does nothing for a payload that names no saved row', () => {
    const cache = seed();
    const before = cache.extract();

    reconcileAddRecipeToFavoritesReplay(
      cache,
      { input: { id: MINTED_ID } },
      { addRecipeToFavorites: null },
    );

    expect(cache.extract()).toEqual(before);
  });
});
