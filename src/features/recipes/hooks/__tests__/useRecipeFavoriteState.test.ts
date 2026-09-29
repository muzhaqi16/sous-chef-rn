import { act, waitFor } from '@testing-library/react-native';
import { gql, type InMemoryCache } from '@apollo/client';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import {
  recordMock,
  renderHookWithApollo,
  type MockFor,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import {
  AddRecipeToFavoritesDocument,
  MySavedRecipesDocument,
  SavedRecipeFoldersDocument,
  type MySavedRecipesQuery,
} from '#features/recipes/graphql/recipe.generated';
import type { MaterializedRecipe } from '#features/recipes/hooks/useRecipeData';
import { makeCache } from '#/apollo/cache';
import { useRecipeFavoriteState } from '../useRecipeFavoriteState';

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
jest.mock('#/services/toastService', () => ({
  toastService: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    info: jest.fn(),
    warning: jest.fn(),
  },
}));

// The SavedRecipe's permanent id is client-minted; a known one lets the cache
// assertions name it.
const SAVED_RECIPE_ID = 'client-saved-1';
const SERVER_SAVED_ID = 'server-saved-2';
jest.mock('#/utils/generateEntityId', () => ({
  generateEntityId: jest.fn(() => 'client-saved-1'),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

// The hook reads only the recipe's id and whether it carries savedDetails.
const recipe = (
  savedDetails: MaterializedRecipe['savedDetails'] = null,
): MaterializedRecipe =>
  ({
    id: 'backend-1',
    savedDetails,
  } as Partial<MaterializedRecipe> as MaterializedRecipe);

const SAVED_DETAILS_FRAGMENT = gql`
  fragment _TestSavedDetails on Recipe {
    id
    savedDetails {
      id
    }
  }
`;
const SAVED_RECIPE_FRAGMENT = gql`
  fragment _TestSavedRecipe on SavedRecipe {
    id
    folder
    tags
    recipe {
      id
    }
  }
`;

/** An empty saved list, so the favorite has a connection to join. */
function seedFavoriteCache(cache: InMemoryCache = makeCache()) {
  cache.writeQuery<MySavedRecipesQuery>({
    query: MySavedRecipesDocument,
    data: {
      __typename: 'Query',
      me: {
        __typename: 'User',
        id: 'u1',
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
  return cache;
}

const readSavedDetails = (cache: InMemoryCache) =>
  cache.readFragment<{ savedDetails: { id: string } | null }>({
    id: cache.identify({ __typename: 'Recipe', id: 'backend-1' }) ?? '',
    fragment: SAVED_DETAILS_FRAGMENT,
  })?.savedDetails;

const readSavedRecipe = (cache: InMemoryCache) =>
  cache.readFragment<{
    id: string;
    folder: string | null;
    tags: string[];
    recipe: { id: string };
  }>({
    id:
      cache.identify({ __typename: 'SavedRecipe', id: SAVED_RECIPE_ID }) ?? '',
    fragment: SAVED_RECIPE_FRAGMENT,
  });

const readSavedEdges = (cache: InMemoryCache) =>
  cache.readQuery<MySavedRecipesQuery>({ query: MySavedRecipesDocument })?.me
    ?.savedRecipesConnection;

/**
 * `queued` resolves the field as null (offline, API down), `created` echoes the
 * client-minted id, `divergent` answers with an existing row saved elsewhere,
 * `rejected` is a refusal.
 */
const favoriteMock = (
  outcome: 'queued' | 'created' | 'divergent' | 'rejected',
): MockFor<typeof AddRecipeToFavoritesDocument> => ({
  request: { query: AddRecipeToFavoritesDocument, variables: () => true },
  result: {
    data: {
      addRecipeToFavorites:
        outcome === 'queued'
          ? null
          : outcome === 'rejected'
          ? {
              __typename: 'ValidationError',
              code: ErrorCode.ValidationFailed,
              message: 'bad',
              field: 'recipeId',
            }
          : {
              __typename: 'AddRecipeToFavoritesPayload',
              savedRecipe: {
                __typename: 'SavedRecipe',
                id: outcome === 'divergent' ? SERVER_SAVED_ID : SAVED_RECIPE_ID,
                recipeId: 'backend-1',
                folder: null,
                tags: [],
                recipe: { __typename: 'Recipe', id: 'backend-1' },
              },
            },
    },
  },
});

function renderFavorite(
  backendRecipe: MaterializedRecipe | undefined,
  {
    cache,
    operationMocks = [],
    onSaved = jest.fn(),
  }: {
    cache?: InMemoryCache;
    operationMocks?: MockedResponse[];
    onSaved?: () => void;
  } = {},
) {
  return renderHookWithApollo(
    () => useRecipeFavoriteState({ backendRecipe, onSaved }),
    { cache, operationMocks },
  );
}

/** Every save that fires ends in a toast, which marks it settled. */
async function save(
  result: { current: ReturnType<typeof useRecipeFavoriteState> },
  ...args: Parameters<
    ReturnType<typeof useRecipeFavoriteState>['handleSaveRecipe']
  >
) {
  act(() => {
    result.current.handleSaveRecipe(...args);
  });
  await waitFor(() =>
    expect(
      mockToastSuccess.mock.calls.length + mockToastError.mock.calls.length,
    ).toBe(1),
  );
  await waitFor(() => expect(result.current.saving).toBe(false));
}

describe('useRecipeFavoriteState', () => {
  describe('isSaved', () => {
    it('is true for a recipe carrying savedDetails', () => {
      const { result } = renderFavorite(
        recipe({
          __typename: 'SavedRecipe',
          id: 'sd-1',
          folder: 'F',
          tags: [],
          notes: null,
          personalRating: null,
          cookedCount: 0,
        }),
      );
      expect(result.current.isSaved).toBe(true);
    });

    it('is false for a recipe without savedDetails', () => {
      const { result } = renderFavorite(recipe());
      expect(result.current.isSaved).toBe(false);
    });

    it('is false while there is no recipe yet', () => {
      const { result } = renderFavorite(undefined);
      expect(result.current.isSaved).toBe(false);
    });
  });

  describe('handleSaveRecipe', () => {
    it('does nothing while there is no recipe to save', async () => {
      const favorite = recordMock(AddRecipeToFavoritesDocument);
      const onSaved = jest.fn();
      const { result } = renderFavorite(undefined, {
        operationMocks: [favorite.mock],
        onSaved,
      });

      act(() => {
        result.current.handleSaveRecipe('Dinner');
      });

      expect(favorite.fired).toHaveLength(0);
      expect(result.current.saving).toBe(false);
      expect(onSaved).not.toHaveBeenCalled();
    });

    it('favorites the recipe by its id with the chosen folder, tags and notes', async () => {
      const favorite = recordMock(AddRecipeToFavoritesDocument, {
        data: { addRecipeToFavorites: null },
      });
      const { result } = renderFavorite(recipe(), {
        cache: seedFavoriteCache(),
        operationMocks: [favorite.mock],
      });

      await save(result, 'Dinner', ['quick'], 'tasty');

      expect(favorite.fired).toEqual([
        {
          input: {
            id: SAVED_RECIPE_ID,
            recipeId: 'backend-1',
            folder: 'Dinner',
            tags: ['quick'],
            notes: 'tasty',
          },
        },
      ]);
    });

    it('leaves out an empty folder, tags and blank notes', async () => {
      const favorite = recordMock(AddRecipeToFavoritesDocument, {
        data: { addRecipeToFavorites: null },
      });
      const { result } = renderFavorite(recipe(), {
        cache: seedFavoriteCache(),
        operationMocks: [favorite.mock],
      });

      await save(result, null, [], ' ');

      expect(favorite.fired).toEqual([
        { input: { id: SAVED_RECIPE_ID, recipeId: 'backend-1' } },
      ]);
    });

    it('lists a new folder once the save lands', async () => {
      const cache = seedFavoriteCache();
      cache.writeQuery({
        query: SavedRecipeFoldersDocument,
        data: { __typename: 'Query', savedRecipeFolders: ['Favorites'] },
      });
      const favorite = recordMock(AddRecipeToFavoritesDocument, {
        data: {
          addRecipeToFavorites: {
            __typename: 'AddRecipeToFavoritesPayload',
            savedRecipe: {
              __typename: 'SavedRecipe',
              id: SAVED_RECIPE_ID,
              folder: 'Weeknight',
              recipe: { __typename: 'Recipe', id: 'backend-1' },
            },
          },
        },
      });
      const { result } = renderFavorite(recipe(), {
        cache,
        operationMocks: [favorite.mock],
      });

      await save(result, 'Weeknight');

      expect(
        cache.readQuery({ query: SavedRecipeFoldersDocument })
          ?.savedRecipeFolders,
      ).toEqual(['Favorites', 'Weeknight']);
      expect(mockToastSuccess).toHaveBeenCalledTimes(1);
      expect(result.current.saving).toBe(false);
    });
  });

  describe('local-first favorite', () => {
    it('writes the SavedRecipe, savedDetails and saved-list edge before the server answers', async () => {
      const cache = seedFavoriteCache();
      const onSaved = jest.fn();
      const { result } = renderFavorite(recipe(), {
        cache,
        operationMocks: [favoriteMock('queued')],
        onSaved,
      });

      await save(result, 'Dinner', ['quick']);

      expect(readSavedRecipe(cache)).toEqual(
        expect.objectContaining({
          id: SAVED_RECIPE_ID,
          folder: 'Dinner',
          tags: ['quick'],
          recipe: expect.objectContaining({ id: 'backend-1' }),
        }),
      );
      expect(readSavedDetails(cache)).toEqual(
        expect.objectContaining({ id: SAVED_RECIPE_ID }),
      );
      const conn = readSavedEdges(cache);
      expect(conn?.totalCount).toBe(1);
      expect(conn?.edges.map(e => e.node.id)).toContain(SAVED_RECIPE_ID);
      // Queued is not a failure: the save reports itself done.
      expect(onSaved).toHaveBeenCalledTimes(1);
      expect(mockToastSuccess).toHaveBeenCalledTimes(1);
    });

    it('takes all three writes back when the server refuses', async () => {
      const cache = seedFavoriteCache();
      const onSaved = jest.fn();
      const { result } = renderFavorite(recipe(), {
        cache,
        operationMocks: [favoriteMock('rejected')],
        onSaved,
      });

      await save(result);

      expect(readSavedRecipe(cache)).toBeNull();
      expect(readSavedDetails(cache) ?? null).toBeNull();
      const conn = readSavedEdges(cache);
      expect(conn?.totalCount).toBe(0);
      expect(conn?.edges).toHaveLength(0);
      expect(onSaved).not.toHaveBeenCalled();
      expect(mockToastError).toHaveBeenCalledTimes(1);
      expect(mockToastSuccess).not.toHaveBeenCalled();
    });

    it('does not duplicate the saved-list edge when the server echoes the client id', async () => {
      const cache = seedFavoriteCache();
      const { result } = renderFavorite(recipe(), {
        cache,
        operationMocks: [favoriteMock('created')],
      });

      await save(result);

      const conn = readSavedEdges(cache);
      expect(
        conn?.edges.filter(e => e.node.id === SAVED_RECIPE_ID),
      ).toHaveLength(1);
      expect(conn?.totalCount).toBe(1);
    });

    it('adopts the server’s row when the recipe was already saved elsewhere', async () => {
      const cache = seedFavoriteCache();
      const { result } = renderFavorite(recipe(), {
        cache,
        operationMocks: [favoriteMock('divergent')],
      });

      await save(result);

      expect(readSavedRecipe(cache)).toBeNull();
      expect(readSavedDetails(cache)).toEqual(
        expect.objectContaining({ id: SERVER_SAVED_ID }),
      );
      const ids = readSavedEdges(cache)?.edges.map(e => e.node.id) ?? [];
      expect(ids).toEqual([SERVER_SAVED_ID]);
      expect(readSavedEdges(cache)?.totalCount).toBe(1);
    });
  });
});
