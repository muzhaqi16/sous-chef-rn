import { waitFor } from '@testing-library/react-native';
import {
  renderHookWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { useRecipeFormWrites } from '#features/recipes/hooks/useRecipeFormWrites';
import {
  UpdateRecipeDocument,
  UpdateRecipeIngredientsDocument,
} from '#features/recipes/graphql/recipe.generated';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { t } from '#/i18n';

/**
 * An edit is two writes in parallel. Reporting the pair as saved when either
 * leg was refused leaves the screen closing on a change the server discarded —
 * and the message has to come from the leg that was actually refused.
 */
const RECIPE_ID = 'recipe-1';

const updateMock = (payload: Record<string, unknown>): MockedResponse => ({
  request: { query: UpdateRecipeDocument, variables: () => true },
  result: { data: { updateRecipe: payload } },
});

const ingredientsMock = (payload: Record<string, unknown>): MockedResponse => ({
  request: { query: UpdateRecipeIngredientsDocument, variables: () => true },
  result: { data: { updateRecipeIngredients: payload } },
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
  it('reports rejected when only the INGREDIENTS leg is refused', async () => {
    const { result } = renderWrites([
      updateMock({ __typename: 'UpdateRecipePayload' }),
      ingredientsMock(REFUSAL),
    ]);
    await waitFor(() => expect(result.current.updateRecipe).toBeDefined());

    const outcome = await result.current.updateRecipe(RECIPE_ID, {}, []);

    // The REFUSED leg's failure — the recipe leg succeeded and has none.
    expect(outcome).toEqual({
      status: 'rejected',
      failure: expect.objectContaining(REFUSED_FAILURE),
    });
  });

  it('reports rejected when only the RECIPE leg is refused', async () => {
    const { result } = renderWrites([
      updateMock(REFUSAL),
      ingredientsMock({ __typename: 'UpdateRecipeIngredientsPayload' }),
    ]);
    await waitFor(() => expect(result.current.updateRecipe).toBeDefined());

    const outcome = await result.current.updateRecipe(RECIPE_ID, {}, []);

    expect(outcome).toEqual({
      status: 'rejected',
      failure: expect.objectContaining(REFUSED_FAILURE),
    });
  });

  it('reports ok only when both legs land', async () => {
    const { result } = renderWrites([
      updateMock({ __typename: 'UpdateRecipePayload' }),
      ingredientsMock({ __typename: 'UpdateRecipeIngredientsPayload' }),
    ]);
    await waitFor(() => expect(result.current.updateRecipe).toBeDefined());

    const outcome = await result.current.updateRecipe(RECIPE_ID, {}, []);

    expect(outcome.status).toBe('ok');
  });
});
