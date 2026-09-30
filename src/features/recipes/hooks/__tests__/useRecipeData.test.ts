import { act, waitFor } from '@testing-library/react-native';
import type { InMemoryCache } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { ExternalSyncStatus } from '#/graphql/generated/schemaTypes';
import {
  recordMock,
  renderHookWithApollo,
  statesFutureSchemaValues,
  type MockDataFor,
  type MockedResponse,
  type MockFor,
} from '#/test-utils/apolloMockProvider';
import { GetRecipeDocument } from '#features/recipes/graphql/recipe.generated';
import { writeLocalFavorite } from '#features/recipes/cache/favorites';
import { useRecipeData, type UseRecipeDataParams } from '../useRecipeData';
import type { CatalogRecipeHint } from '../useOpenCatalogRecipe';

type RecipeFixture = NonNullable<
  MockDataFor<typeof GetRecipeDocument>['recipe']
>;

const HINT: CatalogRecipeHint = {
  externalId: '716429',
  name: 'Pasta with Garlic',
  imageUrl: 'https://img.spoonacular.com/recipes/716429-556x370.jpg',
};

/** A recipe the user wrote: no provider behind it. */
const authoredRecipe = (overrides: RecipeFixture = {}): RecipeFixture => ({
  __typename: 'Recipe',
  id: 'r1',
  name: 'Pasta',
  isExternal: false,
  sourceMapping: null,
  externalDetails: null,
  ...overrides,
});

/** A Spoonacular recipe the API holds, in the given sync state. */
const catalogRecipe = (
  syncStatus: ExternalSyncStatus,
  overrides: RecipeFixture = {},
): RecipeFixture => ({
  __typename: 'Recipe',
  id: 'r1',
  name: 'Catalog Pasta',
  isExternal: true,
  createdBy: null,
  sourceMapping: { __typename: 'RecipeSourceMapping', id: 'sm-1', syncStatus },
  ...overrides,
});

const recipeMock = (recipe: RecipeFixture) =>
  recordMock(GetRecipeDocument, { data: { recipe } }).mock;

function renderData(
  params: Partial<UseRecipeDataParams>,
  operationMocks: MockedResponse[] = [],
  cache: InMemoryCache = makeCache(),
) {
  return renderHookWithApollo(
    () =>
      useRecipeData({
        recipeId: undefined,
        hint: undefined,
        openFailure: null,
        ...params,
      }),
    { operationMocks, cache },
  );
}

describe('useRecipeData', () => {
  describe('a recipe opened by id', () => {
    it('shows the API recipe', async () => {
      const { result } = renderData({ recipeId: 'r1' }, [
        recipeMock(
          authoredRecipe({
            name: 'Pasta Carbonara',
            servings: 2,
            totalTimeMinutes: 30,
            description: 'Classic Italian',
            imageUrl: 'https://example.com/pasta.jpg',
          }),
        ),
      ]);

      await waitFor(() => expect(result.current.displayData).not.toBeNull());

      expect(result.current.displayData).toEqual(
        expect.objectContaining({
          title: 'Pasta Carbonara',
          servings: 2,
          readyInMinutes: 30,
          summary: 'Classic Italian',
          image: 'https://example.com/pasta.jpg',
          details: 'complete',
        }),
      );
      expect(result.current.backendRecipe?.id).toBe('r1');
      expect(result.current.error).toBeNull();
    });

    it('carries no provider chips for a recipe the user wrote', async () => {
      const { result } = renderData({ recipeId: 'r1' }, [
        recipeMock(authoredRecipe()),
      ]);

      await waitFor(() => expect(result.current.displayData).not.toBeNull());

      expect(result.current.displayData).toEqual(
        expect.objectContaining({
          healthScore: undefined,
          vegetarian: undefined,
          vegan: undefined,
          glutenFree: undefined,
          dairyFree: undefined,
        }),
      );
    });

    it('reads the health score and diet chips from the provider details', async () => {
      const { result } = renderData({ recipeId: 'r1' }, [
        recipeMock(
          catalogRecipe(ExternalSyncStatus.Synced, {
            externalDetails: {
              __typename: 'SpoonacularRecipeDetails',
              healthScore: 75,
              vegetarian: true,
              vegan: false,
              glutenFree: true,
              dairyFree: null,
            },
          }),
        ),
      ]);

      await waitFor(() => expect(result.current.displayData).not.toBeNull());

      expect(result.current.displayData).toEqual(
        expect.objectContaining({
          healthScore: 75,
          vegetarian: true,
          vegan: false,
          glutenFree: true,
          dairyFree: undefined,
        }),
      );
    });

    it('waits on the recipe itself once its id is known', () => {
      const { result } = renderData({ recipeId: 'r1', hint: HINT }, [
        recipeMock(authoredRecipe()),
      ]);

      expect(result.current.displayData).toBeNull();
      expect(result.current.loading).toBe(true);
    });

    it('prefers the API recipe over the row it was opened from', async () => {
      const { result } = renderData({ recipeId: 'r1', hint: HINT }, [
        recipeMock(catalogRecipe(ExternalSyncStatus.Synced, { name: 'API' })),
      ]);

      await waitFor(() =>
        expect(result.current.displayData?.title).toBe('API'),
      );
      expect(result.current.loading).toBe(false);
    });
  });

  describe('what a catalog recipe has to show', () => {
    it.each([
      [ExternalSyncStatus.Synced, 'complete'],
      [ExternalSyncStatus.ClientSupplied, 'complete'],
      [ExternalSyncStatus.Pending, 'pending'],
      [ExternalSyncStatus.NotFound, 'unavailable'],
    ])('%s reads as %s', async (syncStatus, details) => {
      const { result } = renderData({ recipeId: 'r1' }, [
        recipeMock(catalogRecipe(syncStatus)),
      ]);

      await waitFor(() => expect(result.current.displayData).not.toBeNull());

      expect(result.current.displayData?.details).toBe(details);
    });

    it('shows what it carries for a sync state newer than this build', async () => {
      // A member newer than this build's enum; the cast is the point.
      const newerStatus: string = 'REFETCHING';
      const future: MockFor<typeof GetRecipeDocument> =
        statesFutureSchemaValues({
          request: { query: GetRecipeDocument, variables: () => true },
          result: {
            data: {
              recipe: {
                __typename: 'Recipe',
                id: 'r1',
                name: 'Catalog Pasta',
                isExternal: true,
                sourceMapping: {
                  __typename: 'RecipeSourceMapping',
                  id: 'sm-1',
                  syncStatus: newerStatus as ExternalSyncStatus,
                },
              },
            },
          },
        });

      const { result } = renderData({ recipeId: 'r1' }, [future]);

      await waitFor(() => expect(result.current.displayData).not.toBeNull());

      expect(result.current.displayData?.details).toBe('complete');
    });
  });

  describe('a catalog recipe still being opened', () => {
    it('shows the row’s name and image while its id is on the way', () => {
      const { result } = renderData({ hint: HINT });

      expect(result.current.displayData).toEqual({
        title: 'Pasta with Garlic',
        image: HINT.imageUrl,
        ingredients: [],
        details: 'opening',
      });
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('waits without a title when the row gave none', () => {
      const { result } = renderData({
        hint: { externalId: '716429' },
      });

      expect(result.current.displayData).toBeNull();
      expect(result.current.loading).toBe(true);
    });

    it('says why the recipe could not be opened', () => {
      const { result } = renderData({
        hint: HINT,
        openFailure: 'Recipe not found',
      });

      expect(result.current.error).toBe('Recipe not found');
      expect(result.current.displayData).toBeNull();
      expect(result.current.loading).toBe(false);
    });
  });

  it('reports "Recipe not found" with neither an id nor a hint', () => {
    const { result } = renderData({});

    expect(result.current.error).toBe('Recipe not found');
    expect(result.current.displayData).toBeNull();
    expect(result.current.loading).toBe(false);
  });
  // Each of these edits only fields behind the query's mask, so `GetRecipe`'s
  // result stays the same object while the screen stays open.
  describe('an edit to the open recipe', () => {
    const openRecipe = async (recipe: RecipeFixture) => {
      const cache = makeCache();
      const rendered = renderData(
        { recipeId: 'r1' },
        [recipeMock(recipe)],
        cache,
      );
      await waitFor(() =>
        expect(rendered.result.current.backendRecipe).toBeDefined(),
      );
      return { cache, ...rendered };
    };

    it('shows a save, and then its notes and rating', async () => {
      const { cache, result } = await openRecipe(
        authoredRecipe({ savedDetails: null }),
      );
      expect(result.current.backendRecipe?.savedDetails).toBeNull();

      await act(async () => {
        writeLocalFavorite(cache, 'saved-1', 'r1', { notes: 'Less salt' });
        await Promise.resolve();
      });
      await waitFor(() =>
        expect(result.current.backendRecipe?.savedDetails?.notes).toBe(
          'Less salt',
        ),
      );

      await act(async () => {
        cache.modify({
          id: cache.identify({ __typename: 'SavedRecipe', id: 'saved-1' }),
          fields: { personalRating: () => 4 },
        });
        await Promise.resolve();
      });
      await waitFor(() =>
        expect(result.current.backendRecipe?.savedDetails?.personalRating).toBe(
          4,
        ),
      );
    });

    it('drops the pending notice once the recipe is fetched', async () => {
      const { cache, result } = await openRecipe(
        catalogRecipe(ExternalSyncStatus.Pending),
      );
      expect(result.current.displayData?.details).toBe('pending');

      await act(async () => {
        cache.modify({
          id: cache.identify({ __typename: 'RecipeSourceMapping', id: 'sm-1' }),
          fields: { syncStatus: () => ExternalSyncStatus.Synced },
        });
        await Promise.resolve();
      });

      await waitFor(() =>
        expect(result.current.displayData?.details).toBe('complete'),
      );
    });
  });
});
