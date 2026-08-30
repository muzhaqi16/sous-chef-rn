import { act } from '@testing-library/react-native';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import {
  ForkRecipeDocument,
  UpdateRecipeDocument,
} from '#features/recipes/graphql/recipe.generated';
import { useForkRecipe } from '../useForkRecipe';
import { usePublishRecipe } from '../usePublishRecipe';

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

describe('useForkRecipe', () => {
  it('returns null when the fork is rejected', async () => {
    const { result } = renderHookWithApollo(() => useForkRecipe(), {
      operationMocks: [
        {
          request: { query: ForkRecipeDocument, variables: () => true },
          result: {
            data: {
              forkRecipe: {
                __typename: 'ForbiddenError',
                code: 'FORBIDDEN',
                message: 'nope',
              },
            },
          },
        },
      ],
    });

    let id: string | null = 'unset';
    await act(async () => {
      id = await result.current.forkRecipe('recipe-1');
    });
    expect(id).toBeNull();
  });
});

describe('usePublishRecipe', () => {
  it('returns true when the publish is queued offline', async () => {
    const { result } = renderHookWithApollo(() => usePublishRecipe(), {
      operationMocks: [
        {
          request: { query: UpdateRecipeDocument, variables: () => true },
          result: { data: { updateRecipe: null } }, // queued signature
        },
      ],
    });

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.setPublished('recipe-1', true);
    });
    expect(ok).toBe(true);
  });

  it('returns false when the update is rejected', async () => {
    const { result } = renderHookWithApollo(() => usePublishRecipe(), {
      operationMocks: [
        {
          request: { query: UpdateRecipeDocument, variables: () => true },
          result: {
            data: {
              updateRecipe: {
                __typename: 'ValidationError',
                code: 'VALIDATION_FAILED',
                message: 'bad',
                field: 'status',
              },
            },
          },
        },
      ],
    });

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.setPublished('recipe-1', false);
    });
    expect(ok).toBe(false);
  });
});
