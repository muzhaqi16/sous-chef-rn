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

/**
 * An edit is two writes in parallel. Reporting the pair as saved when either
 * leg was refused leaves the screen closing on a change the server discarded —
 * and the message has to come from the leg that was actually refused, since a
 * success payload resolves to no message at all.
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
  code: 'VALIDATION_FAILED',
  message: 'nope',
  field: 'name',
};

describe('useRecipeFormWrites.updateRecipe', () => {
  it('reports rejected when only the INGREDIENTS leg is refused', async () => {
    const { result } = renderWrites([
      updateMock({ __typename: 'UpdateRecipePayload' }),
      ingredientsMock(REFUSAL),
    ]);
    await waitFor(() => expect(result.current.updateRecipe).toBeDefined());

    const outcome = await result.current.updateRecipe(RECIPE_ID, {}, []);

    expect(outcome.status).toBe('rejected');
    // The REFUSED leg's payload — the recipe's success payload would resolve
    // to no localized message and the alert would be blank.
    expect(outcome.payload).toMatchObject({ __typename: 'ValidationError' });
  });

  it('reports rejected when only the RECIPE leg is refused', async () => {
    const { result } = renderWrites([
      updateMock(REFUSAL),
      ingredientsMock({ __typename: 'UpdateRecipeIngredientsPayload' }),
    ]);
    await waitFor(() => expect(result.current.updateRecipe).toBeDefined());

    const outcome = await result.current.updateRecipe(RECIPE_ID, {}, []);

    expect(outcome.status).toBe('rejected');
    expect(outcome.payload).toMatchObject({ __typename: 'ValidationError' });
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
