import type { MockFor } from '#/test-utils/apolloMockProvider';
import {
  recordMock,
  renderHookWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { drained, drainTimers } from '#/test-utils/drainTimers';
import { useRecipeFormWrites } from '#features/recipes/hooks/useRecipeFormWrites';
import {
  GetRecipeDocument,
  UpdateRecipeDocument,
} from '#features/recipes/graphql/recipe.generated';
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

const appliedUpdate = () =>
  recordMock(UpdateRecipeDocument, {
    data: {
      updateRecipe: {
        __typename: 'UpdateRecipePayload',
        recipe: { id: RECIPE_ID },
      },
    },
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

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useRecipeFormWrites.updateRecipe', () => {
  it('sends the fields and the ingredient list in one write', async () => {
    const update = appliedUpdate();
    const { result } = renderWrites([update.mock]);
    await drainTimers();
    expect(result.current.updateRecipe).toBeDefined();
    const ingredients = [{ name: 'Flour', quantity: 2, sortOrder: 0 }];

    const outcome = await drained(() =>
      result.current.updateRecipe(RECIPE_ID, {
        version: 3,
        ingredientsUnread: false,
        name: 'Bread',
        ingredients,
      }),
    );

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

  // The list REPLACES the recipe's: the form of a recipe over the limit holds
  // one page of it, and would remove every ingredient past that page.
  it('sends nothing for the form of a recipe over the ingredient limit, and says why', async () => {
    const update = appliedUpdate();
    const { result } = renderWrites([update.mock]);
    await drainTimers();
    expect(result.current.updateRecipe).toBeDefined();

    const outcome = await drained(() =>
      result.current.updateRecipe(RECIPE_ID, {
        version: 3,
        ingredientsUnread: true,
        name: 'Bread',
        ingredients: [{ name: 'Flour', quantity: 2, sortOrder: 0 }],
      }),
    );

    expect(outcome).toEqual({
      status: 'rejected',
      failure: {
        code: null,
        field: null,
        title: t('labels.error'),
        body: "This recipe has more than 100 ingredients, so it can't be saved in full. Nothing was changed.",
      },
    });
    expect(update.fired).toEqual([]);
  });

  it('reports the refusal the server gave', async () => {
    const { result } = renderWrites([updateMock(REFUSAL)]);
    await drainTimers();
    expect(result.current.updateRecipe).toBeDefined();

    const outcome = await drained(() =>
      result.current.updateRecipe(RECIPE_ID, {
        version: 3,
        ingredientsUnread: false,
      }),
    );

    expect(outcome).toEqual({
      status: 'rejected',
      failure: expect.objectContaining(REFUSED_FAILURE),
    });
  });

  // The API refuses an edit that states no version, so one the form never read
  // is not sent at all.
  it('fails an edit whose version the form never read, without sending it', async () => {
    const update = appliedUpdate();
    const { result } = renderWrites([update.mock]);
    await drainTimers();
    expect(result.current.updateRecipe).toBeDefined();

    const outcome = await drained(() =>
      result.current.updateRecipe(RECIPE_ID, {
        version: null,
        ingredientsUnread: false,
        name: 'Bread',
      }),
    );

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
    await drainTimers();
    expect(result.current.updateRecipe).toBeDefined();

    const outcome = await drained(() =>
      result.current.updateRecipe(RECIPE_ID, {
        version: 3,
        ingredientsUnread: false,
      }),
    );

    expect(outcome).toEqual({
      status: 'rejected',
      failure: expect.objectContaining({
        code: ErrorCode.VersionConflict,
        title: t('errors.changedElsewhereTitle'),
      }),
    });
  });
});

describe('useRecipeFormWrites.reloadRecipe', () => {
  const recipeMock = (
    answer: Pick<MockFor<typeof GetRecipeDocument>, 'result' | 'error'>,
  ): MockFor<typeof GetRecipeDocument> => ({
    request: { query: GetRecipeDocument, variables: () => true },
    ...answer,
  });
  const loaded = recipeMock({
    result: {
      data: { recipe: { id: RECIPE_ID } },
    },
  });

  const renderLoaded = async (reread: MockFor<typeof GetRecipeDocument>) => {
    const view = renderHookWithApollo(() => useRecipeFormWrites(RECIPE_ID), {
      operationMocks: [loaded, reread],
    });
    await drainTimers();
    expect(view.result.current.recipeRef).not.toBeNull();
    return view;
  };

  it('reads the recipe again from the server', async () => {
    const { result } = await renderLoaded(
      recipeMock({
        result: {
          data: {
            recipe: { id: RECIPE_ID, name: 'Stew' },
          },
        },
      }),
    );

    await expect(drained(() => result.current.reloadRecipe())).resolves.toEqual(
      expect.objectContaining({ name: 'Stew' }),
    );
  });

  // The cache still holds the copy the save was refused against: handing it
  // back would reset the form to it, edit lost and version still stale.
  it('returns nothing when the recipe could not be re-read', async () => {
    const { result } = await renderLoaded(
      recipeMock({ error: new Error('Network request failed') }),
    );
    expect(result.current.readRecipe()).not.toBeNull();

    await expect(
      drained(() => result.current.reloadRecipe()),
    ).resolves.toBeNull();
  });
});
