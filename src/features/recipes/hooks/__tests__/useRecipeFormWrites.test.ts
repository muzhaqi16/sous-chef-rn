import { waitFor } from '@testing-library/react-native';
import type { MockFor } from '#/test-utils/apolloMockProvider';
import {
  recordMock,
  renderHookWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { useRecipeFormWrites } from '#features/recipes/hooks/useRecipeFormWrites';
import { UpdateRecipeDocument } from '#features/recipes/graphql/recipe.generated';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { RECIPE_INGREDIENTS_PAGE_SIZE } from '#domain/recipeIngredientsPaging';
import { t } from '#/i18n';

/**
 * An edit is one write: the fields and the ingredient list under the version,
 * so both land or neither does, and a refusal is reported as the server gave it.
 */
const RECIPE_ID = 'recipe-1';

const updateMock = (
  payload: Record<string, unknown>,
): MockFor<typeof UpdateRecipeDocument> => ({
  request: { query: UpdateRecipeDocument, variables: () => true },
  result: { data: { updateRecipe: payload } },
});

const renderWrites = (mocks: MockedResponse[]) =>
  renderHookWithApollo(() => useRecipeFormWrites(undefined), {
    operationMocks: mocks,
  });

const REFUSAL = {
  __typename: 'ValidationError',
  code: ErrorCode.ValidationFailed,
  message: 'nope',
  field: 'name',
};

// The app's copy, never the server's `message`: `name` has no `errors.field`
// entry, so the body is the caller's fallback.
const REFUSED_FAILURE = {
  code: ErrorCode.ValidationFailed,
  field: REFUSAL.field,
  body: t('recipes.updateRecipeFailed'),
};

describe('useRecipeFormWrites.updateRecipe', () => {
  it('sends the fields and the ingredient list in one write', async () => {
    const update = recordMock(UpdateRecipeDocument, {
      data: {
        updateRecipe: {
          __typename: 'UpdateRecipePayload',
          recipe: { __typename: 'Recipe', id: RECIPE_ID },
        },
      },
    });
    const { result } = renderWrites([update.mock]);
    await waitFor(() => expect(result.current.updateRecipe).toBeDefined());
    const ingredients = [{ name: 'Flour', quantity: 2, sortOrder: 0 }];

    const outcome = await result.current.updateRecipe(RECIPE_ID, {
      version: 3,
      ingredientsUnread: false,
      name: 'Bread',
      ingredients,
    });

    expect(outcome).toEqual({ status: 'ok' });
    // The answer restates the recipe's ingredients at the largest page.
    expect(update.fired).toEqual([
      {
        input: {
          id: RECIPE_ID,
          version: 3,
          name: 'Bread',
          ingredients,
        },
        ingredientsFirst: RECIPE_INGREDIENTS_PAGE_SIZE,
      },
    ]);
  });

  // The list REPLACES the recipe's: a form holding one page of it would remove
  // every ingredient past that page.
  it('sends nothing for a form that loaded a first page of the ingredients, and says why', async () => {
    const update = recordMock(UpdateRecipeDocument, {
      data: {
        updateRecipe: {
          __typename: 'UpdateRecipePayload',
          recipe: { __typename: 'Recipe', id: RECIPE_ID },
        },
      },
    });
    const { result } = renderWrites([update.mock]);
    await waitFor(() => expect(result.current.updateRecipe).toBeDefined());

    const outcome = await result.current.updateRecipe(RECIPE_ID, {
      version: 3,
      ingredientsUnread: true,
      name: 'Bread',
      ingredients: [{ name: 'Flour', quantity: 2, sortOrder: 0 }],
    });

    expect(outcome).toEqual({
      status: 'rejected',
      failure: {
        code: null,
        field: null,
        title: t('labels.error'),
        body: t('recipes.editIngredientsNotLoaded'),
      },
    });
    expect(update.fired).toEqual([]);
  });

  it('reports the refusal the server gave', async () => {
    const { result } = renderWrites([updateMock(REFUSAL)]);
    await waitFor(() => expect(result.current.updateRecipe).toBeDefined());

    const outcome = await result.current.updateRecipe(RECIPE_ID, {
      version: 3,
      ingredientsUnread: false,
    });

    expect(outcome).toEqual({
      status: 'rejected',
      failure: expect.objectContaining(REFUSED_FAILURE),
    });
  });

  // The API refuses an edit that states no version, so one the form never read
  // is not sent at all.
  it('fails an edit whose version the form never read, without sending it', async () => {
    const update = recordMock(UpdateRecipeDocument, {
      data: {
        updateRecipe: {
          __typename: 'UpdateRecipePayload',
          recipe: { __typename: 'Recipe', id: RECIPE_ID },
        },
      },
    });
    const { result } = renderWrites([update.mock]);
    await waitFor(() => expect(result.current.updateRecipe).toBeDefined());

    const outcome = await result.current.updateRecipe(RECIPE_ID, {
      version: null,
      ingredientsUnread: false,
      name: 'Bread',
    });

    expect(outcome).toEqual({
      status: 'rejected',
      failure: expect.objectContaining({
        field: null,
        body: t('recipes.updateRecipeFailed'),
      }),
    });
    expect(update.fired).toEqual([]);
  });

  it('reports an edit made elsewhere since the form loaded', async () => {
    const { result } = renderWrites([
      updateMock({
        __typename: 'ConflictError',
        code: ErrorCode.VersionConflict,
        message: 'stale',
      }),
    ]);
    await waitFor(() => expect(result.current.updateRecipe).toBeDefined());

    const outcome = await result.current.updateRecipe(RECIPE_ID, {
      version: 3,
      ingredientsUnread: false,
    });

    expect(outcome).toEqual({
      status: 'rejected',
      failure: expect.objectContaining({
        code: ErrorCode.VersionConflict,
        title: t('errors.changedElsewhereTitle'),
      }),
    });
  });
});
