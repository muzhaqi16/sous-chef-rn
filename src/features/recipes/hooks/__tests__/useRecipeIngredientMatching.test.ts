import { act, waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import {
  MatchRecipeIngredientsToPantryDocument,
  ConfirmRecipeConsumptionDocument,
} from '#features/recipes/graphql/recipe.generated';
import { logger } from '#/utils/environment';
import type { RootState } from '#store';
import {
  useRecipeIngredientMatching,
  getAvailabilityStatus,
} from '../useRecipeIngredientMatching';

type IngredientMatch = Parameters<typeof getAvailabilityStatus>[0];

function seedIngredientCache(ids: string[]) {
  return seedCache(
    ids.map(id => ({
      __typename: 'RecipeIngredient',
      id,
      name: `Ingredient ${id}`,
      quantity: 1,
      // RecipeIngredientFragment selects estimatedPrice — without it the
      // cache.readFragment in loadMatches is incomplete and returns null,
      // filtering every match out (empty editableMatches).
      estimatedPrice: null,
      image: null,
      isOptional: id === 'ing-3',
      notes: null,
      preparation: null,
      sortOrder: 0,
      section: null,
      item: null,
      unit: {
        __typename: 'Unit',
        id: `u-${id}`,
        name: 'cup',
        symbol: 'cup',
      },
    })),
  );
}

jest.mock('#store/useAppStore', () => ({
  useAppStore: (selector: (s: RootState) => unknown) =>
    selector({ selectedPantryId: 'pantry-1' } as RootState),
  useSelectedPantryId: jest.fn(() => 'pantry-1'),
}));

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
const mockToastInfo = jest.fn();
jest.mock('#/services/toastService', () => ({
  toastService: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    info: (...args: unknown[]) => mockToastInfo(...args),
    warning: jest.fn(),
  },
}));

jest.mock('#/services/telemetry', () => ({
  Telemetry: { trackEvent: jest.fn() },
}));

jest.mock('#/utils/finallyHelpers');

// Deterministic client-minted cooking-log id so we can assert the consumption
// mutation sends it.
jest.mock('#/utils/generateEntityId', () => ({
  generateEntityId: jest.fn(() => 'client-cooklog-1'),
}));

jest.mock('#/apollo/links/tokenScheduler');

beforeEach(() => {
  jest.clearAllMocks();
});

function matchesMock(matches: Record<string, unknown>[]) {
  return recordMock(MatchRecipeIngredientsToPantryDocument, {
    data: {
      matchRecipeIngredientsToPantry: matches.map(m => ({
        __typename: 'RecipeIngredientPantryMatch',
        ...m,
      })),
    },
  });
}

describe('getAvailabilityStatus', () => {
  it('returns "available" when isAvailable and confidence >= 0.8', () => {
    expect(
      getAvailabilityStatus({
        isAvailable: true,
        matchConfidence: 0.9,
        matchedPantryItem: { id: 'pi-1' },
        availableQuantity: 2,
      } as IngredientMatch),
    ).toBe('available');
  });

  it('returns "partial" when pantry item exists, not available, but quantity > 0', () => {
    expect(
      getAvailabilityStatus({
        isAvailable: false,
        matchConfidence: 0.5,
        matchedPantryItem: { id: 'pi-1' },
        availableQuantity: 1,
      } as IngredientMatch),
    ).toBe('partial');
  });

  it('returns "missing" when no pantry item matched', () => {
    expect(
      getAvailabilityStatus({
        isAvailable: false,
        matchConfidence: 0,
        matchedPantryItem: null,
        availableQuantity: 0,
      } as IngredientMatch),
    ).toBe('missing');
  });
});

describe('useRecipeIngredientMatching', () => {
  it('returns initial state with hasPantry true when pantryId exists', () => {
    const { result } = renderHookWithApollo(() =>
      useRecipeIngredientMatching('recipe-1'),
    );

    expect(result.current.hasPantry).toBe(true);
    expect(result.current.editableMatches).toEqual([]);
    expect(result.current.isSheetVisible).toBe(false);
    expect(result.current.matchSummary).toEqual({
      total: 0,
      available: 0,
      partial: 0,
      missing: 0,
      included: 0,
    });
  });

  it('loadMatches shows error when recipeId is undefined', async () => {
    const { result } = renderHookWithApollo(() =>
      useRecipeIngredientMatching(undefined),
    );

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.loadMatches(4);
    });

    expect(success).toBe(false);
    expect(mockToastError).toHaveBeenCalledWith(
      'Recipe or pantry not available',
    );
  });

  it('loadMatches populates editableMatches on success', async () => {
    const matches = [
      {
        ingredient: {
          __typename: 'RecipeIngredient',
          id: 'ing-1',
          isOptional: false,
          unit: {
            __typename: 'Unit',
            id: 'u-ing-1',
            name: 'cup',
            symbol: 'cup',
          },
        },
        isAvailable: true,
        matchConfidence: 0.95,
        matchedPantryItem: { __typename: 'PantryItem', id: 'pi-1' },
        availableQuantity: 5,
        suggestedQuantity: 2,
        suggestedUnit: { __typename: 'Unit', id: 'su-1' },
      },
    ];
    const m = matchesMock(matches);

    const { result } = renderHookWithApollo(
      () => useRecipeIngredientMatching('recipe-1'),
      { operationMocks: [m.mock], cache: seedIngredientCache(['ing-1']) },
    );

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.loadMatches(4);
    });

    expect(success).toBe(true);
    await waitFor(() => expect(result.current.editableMatches).toHaveLength(1));
    expect(result.current.editableMatches[0].adjustedQuantity).toBe(2);
    expect(result.current.isSheetVisible).toBe(true);
  });

  it('logs and drops a match whose cached ingredient fragment is incomplete', async () => {
    // No seedIngredientCache: the only RecipeIngredient write is the match
    // mock's partial `ingredient` (missing most fragment fields), so
    // cache.readFragment returns null. The ingredient must be dropped WITH a
    // diagnostic, not silently vanish.
    const matches = [
      {
        ingredient: {
          __typename: 'RecipeIngredient',
          id: 'ing-1',
          isOptional: false,
          unit: {
            __typename: 'Unit',
            id: 'u-ing-1',
            name: 'cup',
            symbol: 'cup',
          },
        },
        isAvailable: true,
        matchConfidence: 0.95,
        matchedPantryItem: { __typename: 'PantryItem', id: 'pi-1' },
        availableQuantity: 5,
        suggestedQuantity: 2,
        suggestedUnit: { __typename: 'Unit', id: 'su-1' },
      },
    ];
    const m = matchesMock(matches);

    const { result } = renderHookWithApollo(
      () => useRecipeIngredientMatching('recipe-1'),
      { operationMocks: [m.mock] },
    );

    await act(async () => {
      await result.current.loadMatches(4);
    });

    expect(result.current.editableMatches).toHaveLength(0);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('incomplete RecipeIngredient'),
      expect.objectContaining({ ingredientId: 'ing-1' }),
    );
  });

  it('updateMatch updates a specific match entry', async () => {
    const matches = [
      {
        ingredient: {
          __typename: 'RecipeIngredient',
          id: 'ing-1',
          isOptional: false,
          unit: {
            __typename: 'Unit',
            id: 'u-ing-1',
            name: 'cup',
            symbol: 'cup',
          },
        },
        isAvailable: true,
        matchConfidence: 0.9,
        matchedPantryItem: { __typename: 'PantryItem', id: 'pi-1' },
        availableQuantity: 5,
        suggestedQuantity: 2,
        suggestedUnit: { __typename: 'Unit', id: 'su-1' },
      },
    ];
    const m = matchesMock(matches);

    const { result } = renderHookWithApollo(
      () => useRecipeIngredientMatching('recipe-1'),
      { operationMocks: [m.mock], cache: seedIngredientCache(['ing-1']) },
    );

    await act(async () => {
      await result.current.loadMatches(4);
    });
    await waitFor(() => expect(result.current.editableMatches).toHaveLength(1));

    act(() => {
      result.current.updateMatch(0, { adjustedQuantity: 10 });
    });

    expect(result.current.editableMatches[0].adjustedQuantity).toBe(10);
  });

  it('closeSheet hides the sheet', async () => {
    const matches = [
      {
        ingredient: {
          __typename: 'RecipeIngredient',
          id: 'ing-1',
          isOptional: false,
          unit: {
            __typename: 'Unit',
            id: 'u-ing-1',
            name: 'cup',
            symbol: 'cup',
          },
        },
        isAvailable: true,
        matchConfidence: 0.9,
        matchedPantryItem: { __typename: 'PantryItem', id: 'pi-1' },
        availableQuantity: 5,
        suggestedQuantity: 2,
        suggestedUnit: { __typename: 'Unit', id: 'su-1' },
      },
    ];
    const m = matchesMock(matches);

    const { result } = renderHookWithApollo(
      () => useRecipeIngredientMatching('recipe-1'),
      { operationMocks: [m.mock], cache: seedIngredientCache(['ing-1']) },
    );

    await act(async () => {
      await result.current.loadMatches(4);
    });

    await waitFor(() => expect(result.current.isSheetVisible).toBe(true));

    act(() => {
      result.current.closeSheet();
    });

    expect(result.current.isSheetVisible).toBe(false);
  });

  it('matchSummary computes counts correctly', async () => {
    const matches = [
      {
        ingredient: {
          __typename: 'RecipeIngredient',
          id: 'ing-1',
          isOptional: false,
          unit: {
            __typename: 'Unit',
            id: 'u-ing-1',
            name: 'cup',
            symbol: 'cup',
          },
        },
        isAvailable: true,
        matchConfidence: 0.9,
        matchedPantryItem: { __typename: 'PantryItem', id: 'pi-1' },
        availableQuantity: 5,
        suggestedQuantity: 2,
        suggestedUnit: { __typename: 'Unit', id: 'su-1' },
      },
      {
        ingredient: {
          __typename: 'RecipeIngredient',
          id: 'ing-2',
          isOptional: false,
          unit: {
            __typename: 'Unit',
            id: 'u-ing-2',
            name: 'cup',
            symbol: 'cup',
          },
        },
        isAvailable: false,
        matchConfidence: 0.3,
        matchedPantryItem: { __typename: 'PantryItem', id: 'pi-2' },
        availableQuantity: 1,
        suggestedQuantity: 3,
        suggestedUnit: null,
      },
      {
        ingredient: {
          __typename: 'RecipeIngredient',
          id: 'ing-3',
          isOptional: true,
          unit: {
            __typename: 'Unit',
            id: 'u-ing-3',
            name: 'cup',
            symbol: 'cup',
          },
        },
        isAvailable: false,
        matchConfidence: 0,
        matchedPantryItem: null,
        availableQuantity: 0,
        suggestedQuantity: 1,
        suggestedUnit: null,
      },
    ];
    const m = matchesMock(matches);

    const { result } = renderHookWithApollo(
      () => useRecipeIngredientMatching('recipe-1'),
      {
        operationMocks: [m.mock],
        cache: seedIngredientCache(['ing-1', 'ing-2', 'ing-3']),
      },
    );

    await act(async () => {
      await result.current.loadMatches(4);
    });

    await waitFor(() =>
      expect(result.current.matchSummary).toEqual({
        total: 3,
        available: 1,
        partial: 1,
        missing: 1,
        included: 2,
      }),
    );
  });
});

// A single included match (available, with a matched pantry item) so
// confirmConsumption builds a non-empty consumptions array and fires.
const includedMatch = {
  ingredient: {
    __typename: 'RecipeIngredient',
    id: 'ing-1',
    isOptional: false,
    unit: { __typename: 'Unit', id: 'u-ing-1', name: 'cup', symbol: 'cup' },
  },
  isAvailable: true,
  matchConfidence: 0.95,
  matchedPantryItem: {
    __typename: 'PantryItem',
    id: 'pi-1',
    unit: { __typename: 'Unit', id: 'u-ing-1' },
  },
  availableQuantity: 5,
  suggestedQuantity: 2,
  suggestedUnit: { __typename: 'Unit', id: 'su-1' },
};

function confirmMock(outcome: { kind: 'success' } | { kind: 'rejected' }) {
  return recordMock(ConfirmRecipeConsumptionDocument, {
    data:
      outcome.kind === 'success'
        ? {
            confirmRecipeConsumption: {
              __typename: 'ConfirmRecipeConsumptionPayload',
              totalConsumed: 1,
              totalFailed: 0,
              cookingLog: {
                __typename: 'CookingLog',
                id: 'client-cooklog-1',
                servingsMade: 4,
                notes: null,
                cookedAt: '2026-01-01T00:00:00.000Z',
              },
            },
          }
        : {
            confirmRecipeConsumption: {
              __typename: 'ValidationError',
              code: 'VALIDATION',
              message: 'bad',
            },
          },
  });
}

describe('useRecipeIngredientMatching — confirmConsumption', () => {
  async function loadOneMatch(confirm: ReturnType<typeof confirmMock>) {
    const matchesM = matchesMock([includedMatch]);
    const rendered = renderHookWithApollo(
      () => useRecipeIngredientMatching('recipe-1'),
      {
        operationMocks: [matchesM.mock, confirm.mock],
        cache: seedIngredientCache(['ing-1']),
      },
    );

    await act(async () => {
      await rendered.result.current.loadMatches(4);
    });
    await waitFor(() =>
      expect(rendered.result.current.editableMatches).toHaveLength(1),
    );
    return rendered;
  }

  it('sends a client-minted cooking-log id with context.localFirst on success', async () => {
    const confirm = confirmMock({ kind: 'success' });
    const { result } = await loadOneMatch(confirm);

    await act(async () => {
      await result.current.confirmConsumption();
    });

    // The consumption mutation carried the client-minted cooking-log id.
    expect(confirm.fired).toContainEqual(
      expect.objectContaining({
        input: expect.objectContaining({ id: 'client-cooklog-1' }),
      }),
    );
    // Success path: toast + sheet closed + matches cleared.
    expect(mockToastSuccess).toHaveBeenCalled();
    await waitFor(() => expect(result.current.isSheetVisible).toBe(false));
    expect(result.current.editableMatches).toEqual([]);
  });

  it('toasts an error and keeps the sheet open when the server rejects', async () => {
    const confirm = confirmMock({ kind: 'rejected' });
    const { result } = await loadOneMatch(confirm);

    await act(async () => {
      await result.current.confirmConsumption();
    });

    expect(mockToastError).toHaveBeenCalledWith(
      'Failed to mark recipe as cooked',
    );
    expect(mockToastSuccess).not.toHaveBeenCalled();
    // Sheet stays open so the user can retry.
    expect(result.current.isSheetVisible).toBe(true);
    expect(result.current.editableMatches).toHaveLength(1);
  });
});
