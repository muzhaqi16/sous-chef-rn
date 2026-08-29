import { act } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import {
  ForkRecipeDocument,
  UpdateRecipeDocument,
} from '#features/recipes/graphql/recipe.generated';
import { useStore } from '#store';
import { toastService } from '#/services/toastService';
import { useForkRecipe } from '../useForkRecipe';
import { usePublishRecipe } from '../usePublishRecipe';

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

jest.mock('#/services/toastService', () => ({
  toastService: { success: jest.fn(), error: jest.fn() },
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
  afterEach(() => {
    jest.clearAllMocks();
    useStore.setState({ apiReachable: true, isOnline: true });
  });

  it('toasts and skips the mutation when the API is unavailable', async () => {
    useStore.setState({ apiReachable: false });
    const update = recordMock(UpdateRecipeDocument, {
      data: { updateRecipe: { __typename: 'UpdateRecipePayload' } },
    });
    const { result } = renderHookWithApollo(() => usePublishRecipe(), {
      operationMocks: [update.mock],
    });

    expect(result.current.isApiUnavailable).toBe(true);

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.setPublished('recipe-1', true);
    });

    expect(ok).toBe(false);
    expect(toastService.error).toHaveBeenCalledWith('Not available offline');
    expect(update.fired).toHaveLength(0);
  });

  it('fires the mutation and returns true when online', async () => {
    const update = recordMock(UpdateRecipeDocument, {
      data: { updateRecipe: { __typename: 'UpdateRecipePayload' } },
    });
    const { result } = renderHookWithApollo(() => usePublishRecipe(), {
      operationMocks: [update.mock],
    });

    expect(result.current.isApiUnavailable).toBe(false);

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.setPublished('recipe-1', true);
    });

    expect(ok).toBe(true);
    expect(update.fired).toHaveLength(1);
    expect(update.fired[0]).toEqual({
      input: { id: 'recipe-1', status: 'PUBLISHED' },
    });
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
                code: 'VALIDATION_ERROR',
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
