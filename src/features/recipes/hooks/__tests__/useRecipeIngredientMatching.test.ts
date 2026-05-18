import { act, waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import { MatchRecipeIngredientsToPantryDocument } from '#features/recipes/graphql/recipe.generated';
import {
  useRecipeIngredientMatching,
  getAvailabilityStatus,
} from '../useRecipeIngredientMatching';

function seedIngredientCache(ids: string[]) {
  return seedCache(
    ids.map(id => ({
      __typename: 'RecipeIngredient',
      id,
      name: `Ingredient ${id}`,
      quantity: 1,
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
  useAppStore: (selector: (s: any) => any) =>
    selector({ selectedPantryId: 'pantry-1' }),
  useSelectedPantryId: jest.fn(() => 'pantry-1'),
}));

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
const mockToastInfo = jest.fn();
jest.mock('#/services/toastService', () => ({
  toastService: {
    success: (...args: any[]) => mockToastSuccess(...args),
    error: (...args: any[]) => mockToastError(...args),
    info: (...args: any[]) => mockToastInfo(...args),
    warning: jest.fn(),
  },
}));

jest.mock('#/services/telemetry', () => ({
  Telemetry: { trackEvent: jest.fn() },
}));

jest.mock('#/utils/compilerSafeWrappers');

jest.mock('#/apollo/links/tokenScheduler');

beforeEach(() => {
  jest.clearAllMocks();
});

function matchesMock(matches: any[]) {
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
      } as any),
    ).toBe('available');
  });

  it('returns "partial" when pantry item exists, not available, but quantity > 0', () => {
    expect(
      getAvailabilityStatus({
        isAvailable: false,
        matchConfidence: 0.5,
        matchedPantryItem: { id: 'pi-1' },
        availableQuantity: 1,
      } as any),
    ).toBe('partial');
  });

  it('returns "missing" when no pantry item matched', () => {
    expect(
      getAvailabilityStatus({
        isAvailable: false,
        matchConfidence: 0,
        matchedPantryItem: null,
        availableQuantity: 0,
      } as any),
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
