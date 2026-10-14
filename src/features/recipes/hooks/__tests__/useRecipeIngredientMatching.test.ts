import { act, waitFor } from '@testing-library/react-native';
import {
  ErrorCode,
  RecipeIngredientMatchKind,
} from '#/graphql/generated/schemaTypes';
import type { MockDataFor } from '#/test-utils/apolloMockProvider';
import {
  inputOf,
  recordMock,
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import {
  MarkRecipeAsCookedDocument,
  MatchRecipeIngredientsToPantryDocument,
} from '#features/recipes/graphql/recipe.generated';
import { logger } from '#/utils/environment';
import type { RootState } from '#store';
import {
  useRecipeIngredientMatching,
  getAvailabilityStatus,
} from '../useRecipeIngredientMatching';
import { RecipeIngredientFragmentDoc } from '#features/recipes/graphql/recipeFragments.generated';

type IngredientMatch = Parameters<typeof getAvailabilityStatus>[0];

function seedIngredientCache(ids: string[]) {
  return seedCache(
    ids.map(id => ({
      // The production selection the consumer reads, so a thin fixture fails
      // here instead of defining its own idea of complete.
      fragment: RecipeIngredientFragmentDoc,
      data: {
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

jest.mock('#/utils/finallyHelpers');

// Deterministic client-minted cooking-log id so we can assert the cook sends it.
jest.mock('#/utils/generateEntityId', () => ({
  generateEntityId: jest.fn(() => 'client-cooklog-1'),
}));

jest.mock('#/apollo/links/tokenScheduler');

beforeEach(() => {
  jest.clearAllMocks();
});

function matchesMock(
  matches: Record<string, unknown>[],
  options: { partial?: boolean } = {},
) {
  const data: MockDataFor<typeof MatchRecipeIngredientsToPantryDocument> = {
    matchRecipeIngredientsToPantry: matches.map(m => ({
      __typename: 'RecipeIngredientMatch',
      ...m,
    })),
  };
  return recordMock(MatchRecipeIngredientsToPantryDocument, {
    data,
    partial: options.partial,
  });
}

describe('getAvailabilityStatus', () => {
  it('returns "available" for an available stack of a catalog match', () => {
    expect(
      getAvailabilityStatus({
        isAvailable: true,
        matchKind: RecipeIngredientMatchKind.Concept,
        matchedPantryItem: { id: 'pi-1' },
        availableQuantity: 2,
      } as IngredientMatch),
    ).toBe('available');
  });

  it('returns "partial" when the stack holds some, but not enough', () => {
    expect(
      getAvailabilityStatus({
        isAvailable: false,
        matchKind: RecipeIngredientMatchKind.Concept,
        matchedPantryItem: { id: 'pi-1', displayAmount: { quantity: 1 } },
        availableQuantity: 1,
      } as IngredientMatch),
    ).toBe('partial');
  });

  // The server reports null available when the recipe's unit cannot express
  // the stack (a loaf against a pound): unknown, and the stack holds some.
  it('returns "partial" for a stocked stack the recipe unit cannot express', () => {
    expect(
      getAvailabilityStatus({
        isAvailable: false,
        matchKind: RecipeIngredientMatchKind.Item,
        matchedPantryItem: { id: 'pi-1', displayAmount: { quantity: 1 } },
        availableQuantity: null,
      } as IngredientMatch),
    ).toBe('partial');
  });

  it('returns "missing" for a matched stack that holds nothing', () => {
    expect(
      getAvailabilityStatus({
        isAvailable: false,
        matchKind: RecipeIngredientMatchKind.Item,
        matchedPantryItem: { id: 'pi-1', displayAmount: { quantity: 0 } },
        availableQuantity: 0,
      } as IngredientMatch),
    ).toBe('missing');
  });

  // The server's 0.7 is a name match only ("olives" finding "Kalamata Olives"),
  // whatever the stack holds.
  it('returns "unsure" for a stack matched by name only', () => {
    expect(
      getAvailabilityStatus({
        isAvailable: true,
        matchKind: RecipeIngredientMatchKind.Name,
        matchedPantryItem: { id: 'pi-1' },
        availableQuantity: 5,
      } as IngredientMatch),
    ).toBe('unsure');
  });

  it('returns "missing" when no pantry item matched', () => {
    expect(
      getAvailabilityStatus({
        isAvailable: false,
        matchKind: RecipeIngredientMatchKind.None,
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
      unsure: 0,
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
        matchKind: RecipeIngredientMatchKind.Item,
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
    expect(result.current.editableMatches[0]!.adjustedQuantity).toBe(2);
    expect(result.current.isSheetVisible).toBe(true);
  });

  // `$servings` is a Float: two and a half servings is asked for as it is.
  it('asks for the matches of a fractional number of servings, unrounded', async () => {
    const m = matchesMock([]);
    const { result } = renderHookWithApollo(
      () => useRecipeIngredientMatching('recipe-1'),
      { operationMocks: [m.mock] },
    );

    await act(async () => {
      await result.current.loadMatches(2.5);
    });

    expect(m.fired).toEqual([
      { recipeId: 'recipe-1', pantryId: 'pantry-1', servings: 2.5 },
    ]);
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
        matchKind: RecipeIngredientMatchKind.Item,
        matchedPantryItem: { __typename: 'PantryItem', id: 'pi-1' },
        availableQuantity: 5,
        suggestedQuantity: 2,
        suggestedUnit: { __typename: 'Unit', id: 'su-1' },
      },
    ];
    // The partial `ingredient` IS the subject: completing it from the SDL
    // would make `cache.readFragment` succeed and nothing would be dropped.
    // The opt-out rides on THIS mock, so it excuses only the fields this
    // payload omits.
    const m = matchesMock(matches, { partial: true });

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
        matchKind: RecipeIngredientMatchKind.Concept,
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

    expect(result.current.editableMatches[0]!.adjustedQuantity).toBe(10);
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
        matchKind: RecipeIngredientMatchKind.Concept,
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
        matchKind: RecipeIngredientMatchKind.Concept,
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
        matchKind: RecipeIngredientMatchKind.Name,
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
        matchKind: RecipeIngredientMatchKind.None,
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
        partial: 0,
        missing: 1,
        unsure: 1,
        included: 1,
      }),
    );
  });
});

// A single included match (available, with a matched pantry item) so
// confirmConsumption builds a non-empty `ingredientsUsed` and fires.
const includedMatch = {
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
  matchKind: RecipeIngredientMatchKind.Item,
  matchedPantryItem: {
    __typename: 'PantryItem',
    id: 'pi-1',
    unit: { __typename: 'Unit', id: 'u-ing-1' },
  },
  availableQuantity: 5,
  suggestedQuantity: 2,
  suggestedUnit: { __typename: 'Unit', id: 'su-1' },
};

/** A second included match, for a cook that states more than one stack. */
const secondMatch = {
  ...includedMatch,
  ingredient: {
    ...includedMatch.ingredient,
    id: 'ing-2',
    unit: { ...includedMatch.ingredient.unit, id: 'u-ing-2' },
  },
  matchedPantryItem: {
    __typename: 'PantryItem',
    id: 'pi-2',
    unit: { __typename: 'Unit', id: 'u-ing-2' },
  },
  suggestedQuantity: 3,
  // No suggestion: the entry falls back to the ingredient's own unit.
  suggestedUnit: null,
};

type CookPayload = Extract<
  NonNullable<
    MockDataFor<typeof MarkRecipeAsCookedDocument>['markRecipeAsCooked']
  >,
  { __typename?: 'MarkRecipeAsCookedPayload' | null }
>;
type SkippedLine = NonNullable<
  NonNullable<CookPayload['skippedIngredients']>[number]
>;

/** An entry no conversion could take to its stack's unit. */
const skippedLine = (itemName: string): SkippedLine => ({
  __typename: 'SkippedRecipeIngredient',
  itemName,
  code: ErrorCode.UnitInvalid,
});

type CookOutcome =
  | { kind: 'success'; skipped?: string[]; converged?: boolean }
  | { kind: 'queued' }
  | { kind: 'rejected' }
  | { kind: 'transport' };

function cookMock(outcome: CookOutcome) {
  if (outcome.kind === 'transport') {
    return recordMock(MarkRecipeAsCookedDocument, {
      error: new Error('network down'),
    });
  }
  if (outcome.kind === 'queued') {
    // No payload and no error: the offline queue took the write.
    return recordMock(MarkRecipeAsCookedDocument, {
      data: { markRecipeAsCooked: null },
    });
  }
  if (outcome.kind === 'rejected') {
    return recordMock(MarkRecipeAsCookedDocument, {
      data: {
        markRecipeAsCooked: {
          __typename: 'ValidationError',
          code: ErrorCode.ValidationFailed,
          message: 'bad',
          field: null,
        },
      },
    });
  }
  return recordMock(MarkRecipeAsCookedDocument, {
    data: {
      markRecipeAsCooked: {
        __typename: 'MarkRecipeAsCookedPayload',
        converged: outcome.converged ?? false,
        // Stated even when empty: left out, the SDL fills in entries.
        skippedIngredients: (outcome.skipped ?? []).map(skippedLine),
        cookingLog: {
          __typename: 'CookingLog',
          id: 'client-cooklog-1',
          servingsMade: 4,
          notes: null,
          cookedAt: '2026-01-01T00:00:00.000Z',
        },
      },
    },
  });
}

describe('useRecipeIngredientMatching — confirmConsumption', () => {
  async function loadMatchesFor(
    matches: Record<string, unknown>[],
    cook: ReturnType<typeof cookMock>,
  ) {
    const matchesM = matchesMock(matches);
    const rendered = renderHookWithApollo(
      () => useRecipeIngredientMatching('recipe-1'),
      {
        operationMocks: [matchesM.mock, cook.mock],
        cache: seedIngredientCache(['ing-1', 'ing-2']),
      },
    );

    await act(async () => {
      await rendered.result.current.loadMatches(4);
    });
    await waitFor(() =>
      expect(rendered.result.current.editableMatches).toHaveLength(
        matches.length,
      ),
    );
    return rendered;
  }

  const loadOneMatch = (cook: ReturnType<typeof cookMock>) =>
    loadMatchesFor([includedMatch], cook);

  it('sends the reviewed cook as one write that deducts exactly the stacks stated', async () => {
    const cook = cookMock({ kind: 'success' });
    const { result } = await loadOneMatch(cook);

    await act(async () => {
      await result.current.confirmConsumption();
    });

    // The cooking-log id is minted here, so a replayed cook converges on it.
    expect(cook.fired).toEqual([
      {
        input: {
          id: 'client-cooklog-1',
          recipeId: 'recipe-1',
          pantryId: 'pantry-1',
          deductFromPantry: true,
          exactStacks: true,
          ingredientsUsed: [
            {
              recipeIngredientId: 'ing-1',
              pantryItemId: 'pi-1',
              actualQuantity: 2,
              actualUnitId: 'su-1',
            },
          ],
        },
        stacksFirst: 100,
      },
    ]);
    // Success path: toast + sheet closed + matches cleared.
    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Deducted 1 ingredient from pantry',
    );
    expect(mockToastError).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.isSheetVisible).toBe(false));
    expect(result.current.editableMatches).toEqual([]);
  });

  // The log records what the cook entered before the review, not the
  // recipe's own servings and a placeholder note.
  it('records the servings and note the cook entered', async () => {
    const cook = cookMock({ kind: 'success' });
    const { result } = await loadOneMatch(cook);

    await act(async () => {
      await result.current.confirmConsumption({
        servings: 2.5,
        notes: 'Halved it',
      });
    });

    expect(cook.fired).toEqual([
      {
        input: expect.objectContaining({ servings: 2.5, notes: 'Halved it' }),
        stacksFirst: 100,
      },
    ]);
  });

  it('states one entry for each included stack and none for the rest', async () => {
    const cook = cookMock({ kind: 'success' });
    const { result } = await loadMatchesFor(
      [
        includedMatch,
        secondMatch,
        // Offered, never deducted until the user turns it on.
        {
          ...includedMatch,
          ingredient: { ...includedMatch.ingredient, id: 'ing-3' },
          matchKind: RecipeIngredientMatchKind.Name,
          matchedPantryItem: {
            ...includedMatch.matchedPantryItem,
            id: 'pi-3',
          },
        },
        // No stack to draw on at all.
        {
          ...includedMatch,
          ingredient: { ...includedMatch.ingredient, id: 'ing-4' },
          isAvailable: false,
          matchKind: RecipeIngredientMatchKind.None,
          matchedPantryItem: null,
          availableQuantity: 0,
        },
      ],
      cook,
    );

    await act(async () => {
      await result.current.confirmConsumption();
    });

    expect(inputOf(cook.fired[0]!).ingredientsUsed).toEqual([
      {
        recipeIngredientId: 'ing-1',
        pantryItemId: 'pi-1',
        actualQuantity: 2,
        actualUnitId: 'su-1',
      },
      {
        recipeIngredientId: 'ing-2',
        pantryItemId: 'pi-2',
        actualQuantity: 3,
        actualUnitId: 'u-ing-2',
      },
    ]);
    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Deducted 2 ingredients from pantry',
    );
  });

  it('does not deduct a row whose quantity was cleared', async () => {
    const cook = cookMock({ kind: 'success' });
    const { result } = await loadOneMatch(cook);

    act(() => {
      result.current.updateMatch(0, { adjustedQuantity: 0 });
    });
    await act(async () => {
      await result.current.confirmConsumption();
    });

    expect(cook.fired).toEqual([]);
    expect(mockToastInfo).toHaveBeenCalledWith(
      'No ingredients selected for deduction',
    );
  });

  it('leaves a cleared row out of a cook that still deducts another', async () => {
    const cook = cookMock({ kind: 'success' });
    const { result } = await loadMatchesFor([includedMatch, secondMatch], cook);

    act(() => {
      result.current.updateMatch(0, { adjustedQuantity: 0 });
    });
    await act(async () => {
      await result.current.confirmConsumption();
    });

    expect(inputOf(cook.fired[0]!).ingredientsUsed).toEqual([
      expect.objectContaining({ recipeIngredientId: 'ing-2' }),
    ]);
  });

  // A name-only match is offered but not deducted until the user turns it on.
  it('holds back a stack matched by name only until the user includes it', async () => {
    const cook = cookMock({ kind: 'success' });
    const { result } = await loadMatchesFor(
      [{ ...includedMatch, matchKind: RecipeIngredientMatchKind.Name }],
      cook,
    );

    expect(result.current.editableMatches[0]!.isIncluded).toBe(false);
    expect(result.current.editableMatches[0]!.selectedStack?.id).toBe('pi-1');

    act(() => {
      result.current.updateMatch(0, { isIncluded: true });
    });
    await act(async () => {
      await result.current.confirmConsumption();
    });

    expect(inputOf(cook.fired[0]!).ingredientsUsed).toEqual([
      expect.objectContaining({ pantryItemId: 'pi-1' }),
    ]);
  });

  // "Salt, to taste": held, but the recipe states no amount to deduct.
  it('holds back a line stating no amount until the cook states one', async () => {
    const cook = cookMock({ kind: 'success' });
    const { result } = await loadMatchesFor(
      [{ ...includedMatch, suggestedQuantity: null }, secondMatch],
      cook,
    );

    expect(result.current.editableMatches[0]!.isIncluded).toBe(false);

    act(() => {
      result.current.updateMatch(0, { isIncluded: true });
    });
    await act(async () => {
      await result.current.confirmConsumption();
    });

    expect(inputOf(cook.fired[0]!).ingredientsUsed).toEqual([
      expect.objectContaining({ recipeIngredientId: 'ing-2' }),
    ]);
  });

  // The server can pick a stack that holds nothing (an emptied "milk");
  // deducting from it could only fail.
  it('leaves out a line whose matched stack is empty', async () => {
    const matchesM = matchesMock([
      {
        ...includedMatch,
        isAvailable: false,
        availableQuantity: 0,
        matchedPantryItem: {
          ...includedMatch.matchedPantryItem,
          displayAmount: { __typename: 'DisplayAmount', quantity: 0 },
        },
      },
    ]);
    const { result } = renderHookWithApollo(
      () => useRecipeIngredientMatching('recipe-1'),
      {
        operationMocks: [matchesM.mock],
        cache: seedIngredientCache(['ing-1']),
      },
    );
    await act(async () => {
      await result.current.loadMatches(4);
    });
    await waitFor(() => expect(result.current.editableMatches).toHaveLength(1));

    expect(result.current.editableMatches[0]!.isIncluded).toBe(false);
  });

  // "Olive oil" is served by the plain bottle and by the extra virgin stack
  // under its concept; the one the user picks is the one deducted.
  it('deducts from the stack the user picked instead of the server pick', async () => {
    const cook = cookMock({ kind: 'success' });
    const evoo = {
      __typename: 'PantryItem',
      id: 'pi-evoo',
      itemName: 'Extra virgin olive oil',
      unit: { __typename: 'Unit', id: 'u-ml' },
    };
    const { result } = await loadMatchesFor(
      [{ ...includedMatch, alternativeMatches: [evoo] }],
      cook,
    );

    const [first] = result.current.editableMatches;
    if (!first) throw new Error('no match loaded');
    expect(first.stackOptions.map(stack => stack.id)).toEqual([
      'pi-1',
      'pi-evoo',
    ]);
    const picked = first.stackOptions[1];
    act(() => {
      result.current.updateMatch(0, { selectedStack: picked });
    });
    await act(async () => {
      await result.current.confirmConsumption();
    });

    expect(inputOf(cook.fired[0]!).ingredientsUsed).toEqual([
      {
        recipeIngredientId: 'ing-1',
        pantryItemId: 'pi-evoo',
        actualQuantity: 2,
        actualUnitId: 'su-1',
      },
    ]);
  });

  // The cook commits whole; what it reports apart are the entries no
  // conversion could take to their stack's unit.
  it('counts the entries the server skipped apart from the ones it deducted', async () => {
    const cook = cookMock({ kind: 'success', skipped: ['Ingredient ing-2'] });
    const { result } = await loadMatchesFor([includedMatch, secondMatch], cook);

    await act(async () => {
      await result.current.confirmConsumption();
    });

    expect(mockToastSuccess).toHaveBeenCalledTimes(1);
    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Deducted 1 ingredient from pantry (1 not deducted)',
    );
    await waitFor(() => expect(result.current.isSheetVisible).toBe(false));
  });

  it('counts every entry sent when the cook is queued offline', async () => {
    const cook = cookMock({ kind: 'queued' });
    const { result } = await loadMatchesFor([includedMatch, secondMatch], cook);

    await act(async () => {
      await result.current.confirmConsumption();
    });

    expect(cook.fired).toHaveLength(1);
    // No response to count: every entry replays on reconnect.
    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Deducted 2 ingredients from pantry',
    );
    expect(mockToastError).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.isSheetVisible).toBe(false));
    expect(result.current.editableMatches).toEqual([]);
  });

  it('toasts an error and keeps the sheet open when the server rejects', async () => {
    const cook = cookMock({ kind: 'rejected' });
    const { result } = await loadOneMatch(cook);

    await act(async () => {
      await result.current.confirmConsumption();
    });

    // The app's copy for the code the refusal carries, never its `message`.
    expect(mockToastError).toHaveBeenCalledTimes(1);
    expect(mockToastError).toHaveBeenCalledWith(
      'Please check your input and try again',
    );
    expect(mockToastSuccess).not.toHaveBeenCalled();
    // Sheet stays open so the user can retry.
    expect(result.current.isSheetVisible).toBe(true);
    expect(result.current.editableMatches).toHaveLength(1);
  });

  it('toasts once and keeps the sheet open when the request fails', async () => {
    const cook = cookMock({ kind: 'transport' });
    const { result } = await loadOneMatch(cook);

    await act(async () => {
      await result.current.confirmConsumption();
    });

    expect(mockToastError).toHaveBeenCalledTimes(1);
    expect(mockToastError).toHaveBeenCalledWith(
      'Failed to mark recipe as cooked',
    );
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(result.current.isSheetVisible).toBe(true);
    expect(result.current.editableMatches).toHaveLength(1);
  });
});
