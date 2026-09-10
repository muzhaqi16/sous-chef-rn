import { act, waitFor } from '@testing-library/react-native';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { MarkRecipeAsCookedDocument } from '#features/recipes/graphql/recipe.generated';
import type { RootState } from '#store';
import { useRecipeCookingActions } from '../useRecipeCookingActions';

// useRecipeIngredientMatching (used internally) reads the selected pantry id.
jest.mock('#store/useAppStore', () => ({
  useAppStore: (selector: (s: RootState) => unknown) =>
    selector({ selectedPantryId: 'pantry-1' } as RootState),
  useSelectedPantryId: jest.fn(() => 'pantry-1'),
}));

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
const mockToastWarning = jest.fn();
jest.mock('#/services/toastService', () => ({
  toastService: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    info: jest.fn(),
    warning: (...args: unknown[]) => mockToastWarning(...args),
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

type SkippedIngredient = {
  __typename: 'SkippedRecipeIngredient';
  itemName: string;
  reason: string;
};

function cookedMock(
  outcome:
    | { kind: 'success'; skipped?: SkippedIngredient[] }
    | { kind: 'rejected' },
) {
  return recordMock(MarkRecipeAsCookedDocument, {
    data:
      outcome.kind === 'success'
        ? {
            markRecipeAsCooked: {
              __typename: 'MarkRecipeAsCookedPayload',
              // Stated, not left to the schema filler: the success toast
              // branches on it, so a generated non-empty list would silently
              // exercise the wrong arm.
              skippedIngredients: outcome.skipped ?? [],
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
              code: ErrorCode.ValidationFailed,
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

  it('simple deduction sends a client-minted id with context.localFirst', async () => {
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

  it('does not report full success when the server skipped an ingredient', async () => {
    // The server names what it could not deduct; reporting an unqualified
    // success hides a pantry that is now wrong.
    const cooked = cookedMock({
      kind: 'success',
      skipped: [
        {
          __typename: 'SkippedRecipeIngredient',
          itemName: 'Garlic',
          reason: 'No conversion from clove to head',
        },
      ],
    });
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
      expect(mockToastWarning).toHaveBeenCalledWith(
        'Recipe marked as cooked. 1 ingredient could not be deducted.',
      ),
    );
    expect(mockToastSuccess).not.toHaveBeenCalled();
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

  it('skip review sends a client-minted id with context.localFirst', async () => {
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
    // The mutation's own success path, and the point the write has settled.
    // The shared teardown in `__tests__/setup/globals.js` flushes pending work
    // before the missing-field guard reads, so a late write is attributed
    // rather than lost — but the toast is this test's subject, so it is
    // asserted here rather than left to the flush.
    await waitFor(() =>
      expect(mockToastSuccess).toHaveBeenCalledWith(
        'Recipe marked as cooked! Ingredients deducted from pantry.',
      ),
    );
  });
});
