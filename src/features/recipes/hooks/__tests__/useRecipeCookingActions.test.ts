import { act, waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { MarkRecipeAsCookedDocument } from '#features/recipes/graphql/recipe.generated';
import type { RootState } from '#store';
import { useRecipeCookingActions } from '../useRecipeCookingActions';

// useRecipeIngredientMatching (used internally) reads the selected pantry id;
// useIsApiUnavailable reads the network signals through the same store, so the
// state is mutable per test — `apiReachable: false` is what the offline guard
// keys on.
const mockStoreState = {
  selectedPantryId: 'pantry-1',
  isOnline: true,
  apiReachable: true,
};

jest.mock('#store/useAppStore', () => ({
  useAppStore: (selector: (s: RootState) => unknown) =>
    selector(mockStoreState as RootState),
  useSelectedPantryId: jest.fn(() => 'pantry-1'),
}));

beforeEach(() => {
  mockStoreState.isOnline = true;
  mockStoreState.apiReachable = true;
});

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

jest.mock('#/utils/finallyHelpers');

// Deterministic client-minted cooking-log id so we can assert the mutation
// sends it.
jest.mock('#/utils/generateEntityId', () => ({
  generateEntityId: jest.fn(() => 'client-cooklog-1'),
}));

jest.mock('#/apollo/links/tokenScheduler');

beforeEach(() => {
  jest.clearAllMocks();
});

function cookedMock(outcome: { kind: 'success' } | { kind: 'rejected' }) {
  return recordMock(MarkRecipeAsCookedDocument, {
    data:
      outcome.kind === 'success'
        ? {
            markRecipeAsCooked: {
              __typename: 'MarkRecipeAsCookedPayload',
              cookingLog: {
                __typename: 'CookingLog',
                id: 'client-cooklog-1',
                servingsMade: 4,
                notes: null,
                cookedAt: '2026-01-01T00:00:00.000Z',
                recipe: {
                  __typename: 'Recipe',
                  id: 'recipe-1',
                  name: 'Test Recipe',
                },
              },
            },
          }
        : {
            markRecipeAsCooked: {
              __typename: 'ValidationError',
              code: 'VALIDATION',
              message: 'bad',
              field: 'servings',
            },
          },
  });
}

describe('useRecipeCookingActions', () => {
  it('cookExternalError when recipeId is undefined', () => {
    const { result } = renderHookWithApollo(() =>
      useRecipeCookingActions({ recipeId: undefined }),
    );

    act(() => {
      result.current.handleMarkAsCooked({
        servings: 4,
        deductFromPantry: true,
        useGranularDeduction: false,
      });
    });

    expect(mockToastError).toHaveBeenCalledWith(
      'Cannot mark external recipes as cooked. Please save the recipe first.',
    );
  });

  it('simple deduction sends a client-minted id', async () => {
    const cooked = cookedMock({ kind: 'success' });
    const { result } = renderHookWithApollo(
      () => useRecipeCookingActions({ recipeId: 'recipe-1' }),
      { operationMocks: [cooked.mock] },
    );

    await act(async () => {
      result.current.handleMarkAsCooked({
        servings: 4,
        deductFromPantry: true,
        useGranularDeduction: false,
      });
    });

    await waitFor(() => expect(cooked.fired.length).toBeGreaterThan(0));
    expect(cooked.fired).toContainEqual(
      expect.objectContaining({
        input: expect.objectContaining({
          id: 'client-cooklog-1',
          recipeId: 'recipe-1',
          servings: 4,
          deductFromPantry: true,
        }),
      }),
    );
    await waitFor(() =>
      expect(mockToastSuccess).toHaveBeenCalledWith(
        'Recipe marked as cooked! Ingredients deducted from pantry.',
      ),
    );
  });

  it('shows the no-deduction success toast when deductFromPantry is false', async () => {
    const cooked = cookedMock({ kind: 'success' });
    const { result } = renderHookWithApollo(
      () => useRecipeCookingActions({ recipeId: 'recipe-1' }),
      { operationMocks: [cooked.mock] },
    );

    await act(async () => {
      result.current.handleMarkAsCooked({
        servings: 2,
        deductFromPantry: false,
        useGranularDeduction: false,
      });
    });

    await waitFor(() =>
      expect(mockToastSuccess).toHaveBeenCalledWith('Recipe marked as cooked!'),
    );
  });

  it('toasts the failure message and shows no success toast when the server rejects', async () => {
    const cooked = cookedMock({ kind: 'rejected' });
    const { result } = renderHookWithApollo(
      () => useRecipeCookingActions({ recipeId: 'recipe-1' }),
      { operationMocks: [cooked.mock] },
    );

    await act(async () => {
      result.current.handleMarkAsCooked({
        servings: 4,
        deductFromPantry: true,
        useGranularDeduction: false,
      });
    });

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        'Failed to mark recipe as cooked',
      ),
    );
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it('skip review sends a client-minted id', async () => {
    const cooked = cookedMock({ kind: 'success' });
    const { result } = renderHookWithApollo(
      () => useRecipeCookingActions({ recipeId: 'recipe-1' }),
      { operationMocks: [cooked.mock] },
    );

    await act(async () => {
      result.current.handleSkipReview();
    });

    await waitFor(() => expect(cooked.fired.length).toBeGreaterThan(0));
    expect(cooked.fired).toContainEqual(
      expect.objectContaining({
        input: expect.objectContaining({
          id: 'client-cooklog-1',
          recipeId: 'recipe-1',
          deductFromPantry: true,
        }),
      }),
    );
  });

  it('refuses to mark cooked while the API is unavailable', async () => {
    mockStoreState.apiReachable = false;
    const cooked = cookedMock({ kind: 'success' });
    const { result } = renderHookWithApollo(
      () => useRecipeCookingActions({ recipeId: 'recipe-1' }),
      { operationMocks: [cooked.mock] },
    );

    expect(result.current.isApiUnavailable).toBe(true);

    await act(async () => {
      result.current.handleMarkAsCooked({
        servings: 4,
        deductFromPantry: true,
        useGranularDeduction: false,
      });
    });

    expect(mockToastError).toHaveBeenCalledWith('Not available offline');
    expect(cooked.fired).toHaveLength(0);
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it('refuses skip review while the API is unavailable', async () => {
    mockStoreState.apiReachable = false;
    const cooked = cookedMock({ kind: 'success' });
    const { result } = renderHookWithApollo(
      () => useRecipeCookingActions({ recipeId: 'recipe-1' }),
      { operationMocks: [cooked.mock] },
    );

    await act(async () => {
      result.current.handleSkipReview();
    });

    expect(mockToastError).toHaveBeenCalledWith('Not available offline');
    expect(cooked.fired).toHaveLength(0);
  });
});
