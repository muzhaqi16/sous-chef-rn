import { toastService } from '#/services/toastService';
import { act } from '@testing-library/react-native';
import type { InMemoryCache } from '@apollo/client';
import {
  ErrorCode,
  RecipeIngredientMatchKind,
} from '#/graphql/generated/schemaTypes';
import {
  inputOf,
  recordMock,
  renderHookWithApollo,
  seedCache,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { drained, drainTimers } from '#/test-utils/drainTimers';
import {
  MarkRecipeAsCookedDocument,
  MatchRecipeIngredientsToPantryDocument,
} from '#features/recipes/graphql/recipe.generated';
import { UseRecipeData_RecipeFragmentDoc } from '#features/recipes/hooks/useRecipeData.generated';
import type { RootState } from '#store';
import { useSelectedPantryId } from '#store/useAppStore';
import { useRecipeCookingActions } from '../useRecipeCookingActions';
import { askForReviewAfterSuccess } from '#/domain/reviewPrompt';
import { onTutorialEvent, type TutorialEvent } from '#domain/tutorialEvents';

jest.mock('#/domain/reviewPrompt');

// useRecipeIngredientMatching (used internally) reads the selected pantry id.
let mockIsOnline = true;
jest.mock('#store/useAppStore', () => ({
  useAppStore: (selector: (s: RootState) => unknown) =>
    selector({
      selectedPantryId: 'pantry-1',
      isOnline: mockIsOnline,
      apiReachable: null,
    } as RootState),
  useSelectedPantryId: jest.fn(() => 'pantry-1'),
  useSelectedHomeId: jest.fn(() => 'home-1'),
}));

const mockToastSuccess = jest.mocked(toastService.success);
const mockToastError = jest.mocked(toastService.error);
const mockToastWarning = jest.mocked(toastService.warning);
const mockToastInfo = jest.mocked(toastService.info);

// Deterministic client-minted cooking-log id so we can assert the mutation
// sends it.
jest.mock('#/utils/generateEntityId', () => ({
  generateEntityId: jest.fn(() => 'client-cooklog-1'),
}));

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useSelectedPantryId).mockReturnValue('pantry-1');
});

interface SkippedIngredient {
  itemName: string;
  code: ErrorCode;
}

const skip = (itemName: string, code: ErrorCode): SkippedIngredient => ({
  itemName,
  code,
});

// Stated, not left to the schema filler: the success toast branches on it, so
// a generated non-empty list would silently exercise the wrong arm.
const cookedMock = (skippedIngredients: SkippedIngredient[] = []) =>
  recordMock(MarkRecipeAsCookedDocument, {
    data: {
      markRecipeAsCooked: {
        __typename: 'MarkRecipeAsCookedPayload',
        skippedIngredients,
        // The one stack these cooks draw on, which still holds some after.
        cookingLog: {
          pantryItemsUsedConnection: {
            edges: [
              {
                node: {
                  quantityUsed: 1,
                  pantryItem: { id: 'pi-1', quantity: 4 },
                },
              },
            ],
            pageInfo: { hasNextPage: false },
          },
        },
        mealPlanItem: null,
      },
    },
  });

// No payload and no error: the offline queue took the write.
const queuedCookMock = () =>
  recordMock(MarkRecipeAsCookedDocument, {
    data: { markRecipeAsCooked: null },
  });

const refusedCookMock = () =>
  recordMock(MarkRecipeAsCookedDocument, {
    data: {
      markRecipeAsCooked: {
        __typename: 'ValidationError',
        code: ErrorCode.ValidationFailed,
        field: 'servings',
      },
    },
  });

const renderCooking = (
  operationMocks: MockedResponse[],
  cache?: InMemoryCache,
) =>
  renderHookWithApollo(
    () => useRecipeCookingActions({ recipeId: 'recipe-1' }),
    { operationMocks, cache },
  );

type Cooking = ReturnType<typeof useRecipeCookingActions>;

/** A quick cook of four servings that deducts, unless `args` says otherwise. */
const cook = (
  result: { current: Cooking },
  args: Partial<Parameters<Cooking['handleMarkAsCooked']>[0]> = {},
) =>
  act(async () => {
    void result.current.handleMarkAsCooked({
      servings: 4,
      deductFromPantry: true,
      useGranularDeduction: false,
      ...args,
    });
  });

describe('useRecipeCookingActions', () => {
  beforeEach(() => jest.mocked(askForReviewAfterSuccess).mockClear());

  it('cookExternalError when recipeId is undefined', async () => {
    const { result } = renderHookWithApollo(() =>
      useRecipeCookingActions({ recipeId: undefined }),
    );

    await cook(result);

    expect(mockToastError).toHaveBeenCalledWith(
      'Cannot mark external recipes as cooked. Please save the recipe first.',
    );
  });

  it('a deducting quick cook sends a client-minted id and the selected pantry', async () => {
    const cooked = cookedMock();
    const { result } = renderCooking([cooked.mock]);

    await cook(result);

    await drainTimers();
    expect(cooked.fired.length).toBeGreaterThan(0);
    expect(cooked.fired).toEqual([
      {
        input: {
          id: 'client-cooklog-1',
          recipeId: 'recipe-1',
          servings: 4,
          deductFromPantry: true,
          pantryId: 'pantry-1',
        },
        stacksFirst: 100,
      },
    ]);
    await drainTimers();
    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Recipe marked as cooked. Deducted from 1 pantry item.',
    );
    expect(askForReviewAfterSuccess).toHaveBeenCalledTimes(1);
  });

  // Omitted, the server deducts from the default pantry of the default home.
  it('names no pantry for a deducting cook when none is selected', async () => {
    jest.mocked(useSelectedPantryId).mockReturnValue(null);
    const cooked = cookedMock();
    const { result } = renderCooking([cooked.mock]);

    await cook(result);

    await drainTimers();
    expect(cooked.fired).toHaveLength(1);
    expect(inputOf(cooked.fired[0]!)).toMatchObject({ deductFromPantry: true });
    expect(inputOf(cooked.fired[0]!)).not.toHaveProperty('pantryId');
    await drainTimers();
    expect(mockToastSuccess).toHaveBeenCalled();
  });

  // The server names what it could not deduct; an unqualified success would
  // hide a pantry that is now wrong. The code says WHY, so a shared cause is
  // stated, and a mixed batch states none.
  it.each([
    {
      name: 'does not report full success when the server skipped an ingredient',
      skipped: [skip('Garlic', ErrorCode.InternalServerError)],
      toast: 'Recipe marked as cooked. Garlic could not be deducted.',
    },
    {
      name: 'names the other skips and leaves a line stating no amount out of them',
      skipped: [
        skip('Salt', ErrorCode.UnstatedAmount),
        skip('Garlic', ErrorCode.UnitInvalid),
      ],
      toast:
        'Recipe marked as cooked. Garlic could not be deducted: its unit does not convert to the pantry stack.',
    },
    {
      name: 'names the cause when every skip is the same one',
      skipped: [
        skip('Garlic', ErrorCode.UnitInvalid),
        skip('Basil', ErrorCode.UnitInvalid),
      ],
      toast:
        'Recipe marked as cooked. Garlic, Basil could not be deducted: their units do not convert to the pantry stack.',
    },
    {
      // Naming the unit cause here would be true of Garlic and false of Basil.
      name: 'names the lines but claims no cause when the causes differ',
      skipped: [
        skip('Garlic', ErrorCode.UnitInvalid),
        skip('Basil', ErrorCode.InternalServerError),
      ],
      toast: 'Recipe marked as cooked. Garlic, Basil could not be deducted.',
    },
    {
      name: 'caps the names and counts the rest',
      skipped: ['Garlic', 'Basil', 'Thyme', 'Sage', 'Dill'].map(itemName =>
        skip(itemName, ErrorCode.UnitInvalid),
      ),
      toast:
        'Recipe marked as cooked. Garlic, Basil, Thyme and 2 more could not be deducted: their units do not convert to the pantry stack.',
    },
    {
      // itemName is non-null on the wire, but a blank one would read as a gap
      // in the list, so it drops out and the count still accounts for it.
      name: 'states the count alone when no name survives',
      skipped: [skip('  ', ErrorCode.UnitInvalid)],
      toast:
        'Recipe marked as cooked. 1 ingredient could not be deducted: its unit does not convert to the pantry stack.',
    },
  ])('$name', async ({ skipped, toast }) => {
    const { result } = renderCooking([cookedMock(skipped).mock]);

    await cook(result);

    await drainTimers();
    expect(mockToastWarning).toHaveBeenCalledWith(toast);
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it('leaves the cache holding what a cooked stack has left', async () => {
    // A cook publishes no pantry event: the stacks it returns are the update.
    const cache = seedCache([
      { __typename: 'PantryItem', id: 'pi-rice', quantity: 500 },
    ]);
    const cooked = recordMock(MarkRecipeAsCookedDocument, {
      data: {
        markRecipeAsCooked: {
          __typename: 'MarkRecipeAsCookedPayload',
          skippedIngredients: [],
          cookingLog: {
            pantryItemsUsedConnection: {
              edges: [
                { node: { pantryItem: { id: 'pi-rice', quantity: 300 } } },
              ],
            },
          },
        },
      },
    });
    const { result } = renderCooking([cooked.mock], cache);

    await cook(result);

    await drainTimers();
    expect(mockToastSuccess).toHaveBeenCalled();
    expect(cache.extract()['PantryItem:pi-rice']).toMatchObject({
      quantity: 300,
    });
  });

  it('reports a cook that skipped only lines stating no amount as a plain success', async () => {
    // "Salt, to taste" has nothing to deduct: there is nothing for the user to fix.
    const { result } = renderCooking([
      cookedMock([skip('Salt', ErrorCode.UnstatedAmount)]).mock,
    ]);

    await cook(result);

    await drainTimers();
    expect(mockToastSuccess).toHaveBeenCalled();
    expect(mockToastWarning).not.toHaveBeenCalled();
  });

  // Queued work is never described as taken by the server.
  it.each([
    [true, 'Cooked. Your pantry updates when it syncs.'],
    [false, "Cooked. It's saved when it syncs."],
  ])(
    'says a quick cook queued offline (deducting: %s) is saved, never done',
    async (deductFromPantry, said) => {
      const queued = queuedCookMock();
      const { result } = renderCooking([queued.mock]);

      await cook(result, { deductFromPantry });

      await drainTimers();
      expect(queued.fired).toHaveLength(1);
      expect(mockToastInfo).toHaveBeenCalledWith(said);
      expect(mockToastSuccess).not.toHaveBeenCalled();
    },
  );

  it('shows the no-deduction success toast when deductFromPantry is false', async () => {
    const cooked = cookedMock();
    const { result } = renderCooking([cooked.mock]);

    await cook(result, { servings: 2, deductFromPantry: false });

    await drainTimers();
    expect(mockToastSuccess).toHaveBeenCalledWith('Recipe marked as cooked!');
    // A cook that deducts nothing draws on no pantry.
    expect(cooked.fired).toHaveLength(1);
    expect(inputOf(cooked.fired[0]!)).toMatchObject({
      deductFromPantry: false,
    });
    expect(inputOf(cooked.fired[0]!)).not.toHaveProperty('pantryId');
  });

  // A review with nothing to draw still records the cook, and says so.
  it('records a reviewed cook without deducting, and says the pantry was not changed', async () => {
    const cooked = cookedMock();
    const { result } = renderCooking([cooked.mock]);

    await drained(() => result.current.handleRecordWithoutDeducting());

    await drainTimers();
    expect(cooked.fired).toHaveLength(1);
    expect(inputOf(cooked.fired[0]!)).toMatchObject({
      deductFromPantry: false,
    });
    expect(mockToastSuccess).toHaveBeenCalledWith(
      "Recipe marked as cooked. Your pantry wasn't changed.",
    );
  });

  it('toasts the failure message and keeps the sheet open when the server rejects', async () => {
    const { result } = renderCooking([refusedCookMock().mock]);

    const outcome = await drained(() =>
      result.current.handleMarkAsCooked({
        servings: 4,
        deductFromPantry: true,
        useGranularDeduction: false,
      }),
    );

    expect(outcome).toBe('retry');
    // The refusal names `servings`, which has copy of its own.
    await drainTimers();
    expect(mockToastError).toHaveBeenCalledWith(
      'Enter a number of servings greater than zero',
    );
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(askForReviewAfterSuccess).not.toHaveBeenCalled();
  });

  // "Cook from your pantry" waits for this, however the cook was made.
  describe('the event a waiting guide continues on', () => {
    const listen = () => {
      const heard: TutorialEvent[] = [];
      const stop = onTutorialEvent(event => heard.push(event));
      return { heard, stop };
    };

    it('is sent for a cook the server took', async () => {
      const { heard, stop } = listen();
      const { result } = renderCooking([cookedMock().mock]);

      await cook(result);
      await drainTimers();
      stop();

      expect(heard).toEqual(['recipe.cooked']);
    });

    it('is not sent for a refused cook', async () => {
      const { heard, stop } = listen();
      const { result } = renderCooking([refusedCookMock().mock]);

      await cook(result);
      await drainTimers();
      stop();

      expect(heard).toEqual([]);
    });
  });

  it('skip review sends a client-minted id and the selected pantry', async () => {
    const cooked = cookedMock();
    const { result } = renderCooking([cooked.mock]);

    await act(async () => {
      result.current.handleSkipReview();
    });

    await drainTimers();
    expect(cooked.fired.length).toBeGreaterThan(0);
    expect(cooked.fired).toEqual([
      {
        input: {
          id: 'client-cooklog-1',
          recipeId: 'recipe-1',
          deductFromPantry: true,
          pantryId: 'pantry-1',
        },
        stacksFirst: 100,
      },
    ]);
    // The toast is this test's subject, so it is asserted here rather than
    // left to the teardown's flush of pending work.
    await drainTimers();
    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Recipe marked as cooked. Deducted from 1 pantry item.',
    );
  });

  // A cook that asked for the review deducts nothing unreviewed.
  describe('when the ingredient review cannot load', () => {
    const noMatches = () =>
      recordMock(MatchRecipeIngredientsToPantryDocument, {
        error: new Error('Network request failed'),
      });

    it.each([true, false])(
      'keeps the sheet open with the review off, and records nothing (online: %s)',
      async online => {
        mockIsOnline = online;
        const cooked = cookedMock();
        const { result } = renderCooking([noMatches().mock, cooked.mock]);

        const outcome = await drained(() =>
          result.current.handleMarkAsCooked({
            servings: 2,
            deductFromPantry: true,
            useGranularDeduction: true,
          }),
        );
        mockIsOnline = true;

        expect(outcome).toBe('reviewUnavailable');
        expect(cooked.fired).toHaveLength(0);
        expect(mockToastSuccess).not.toHaveBeenCalled();
        expect(mockToastInfo).not.toHaveBeenCalled();
      },
    );
  });

  it('records a recipe with nothing to draw as cooked, its pantry unchanged', async () => {
    const cooked = cookedMock();
    const { result } = renderCooking([
      recordMock(MatchRecipeIngredientsToPantryDocument, {
        data: { matchRecipeIngredientsToPantry: [] },
      }).mock,
      cooked.mock,
    ]);

    const outcome = await drained(() =>
      result.current.handleMarkAsCooked({
        servings: 2,
        deductFromPantry: true,
        useGranularDeduction: true,
      }),
    );
    await drainTimers();

    expect(outcome).toBe('done');
    expect(inputOf(cooked.fired[0]!)).toMatchObject({
      deductFromPantry: false,
    });
    expect(mockToastSuccess).toHaveBeenCalledWith(
      "Recipe marked as cooked. Your pantry wasn't changed.",
    );
  });

  // COOK-03: a cook states what it recorded, never what it asked for.
  it('says a deducting cook that drew on no stack left the pantry unchanged', async () => {
    const cooked = recordMock(MarkRecipeAsCookedDocument, {
      data: {
        markRecipeAsCooked: {
          __typename: 'MarkRecipeAsCookedPayload',
          skippedIngredients: [],
          cookingLog: {
            pantryItemsUsedConnection: {
              edges: [],
              pageInfo: { hasNextPage: false },
            },
          },
          mealPlanItem: null,
        },
      },
    });
    const { result } = renderCooking([cooked.mock]);

    await cook(result);
    await drainTimers();

    expect(mockToastSuccess).toHaveBeenCalledWith(
      "Recipe marked as cooked. Your pantry wasn't changed.",
    );
  });

  // The review opens with the servings and notes the cook entered; skipping it
  // must cook those, not the whole recipe without the notes.
  it('skip review cooks the servings and notes entered before the review', async () => {
    const matches = recordMock(MatchRecipeIngredientsToPantryDocument, {
      data: {
        matchRecipeIngredientsToPantry: [
          {
            matchKind: RecipeIngredientMatchKind.Item,
            matchedPantryItem: { id: 'pi-1' },
          },
        ],
      },
    });
    const cooked = cookedMock();
    const { result } = renderCooking([matches.mock, cooked.mock]);

    await cook(result, {
      servings: 2,
      useGranularDeduction: true,
      notes: 'Halved it',
    });
    await drainTimers();
    expect(result.current.ingredientMatching.isSheetVisible).toBe(true);

    await act(async () => {
      result.current.handleSkipReview();
    });

    await drainTimers();
    expect(cooked.fired.length).toBeGreaterThan(0);
    expect(cooked.fired).toContainEqual(
      expect.objectContaining({
        input: expect.objectContaining({
          servings: 2,
          notes: 'Halved it',
          deductFromPantry: true,
        }),
      }),
    );
    await drainTimers();
    expect(mockToastSuccess).toHaveBeenCalled();
  });

  it('a confirmed review records the servings and notes entered before it', async () => {
    const matches = recordMock(MatchRecipeIngredientsToPantryDocument, {
      data: {
        matchRecipeIngredientsToPantry: [
          {
            matchKind: RecipeIngredientMatchKind.Item,
            availableQuantity: 5,
            suggestedQuantity: 1,
            matchedPantryItem: { id: 'pi-1' },
            ingredient: { id: 'ing-1', isOptional: false },
          },
        ],
      },
    });
    // The reviewed cook is the quick cook's own write, stating its stacks.
    const confirm = cookedMock();
    const { result } = renderCooking([matches.mock, confirm.mock]);

    await cook(result, {
      servings: 2,
      useGranularDeduction: true,
      notes: 'Halved it',
    });
    await drainTimers();
    expect(result.current.ingredientMatching.editableMatches).toHaveLength(1);

    await drained(() => result.current.handleConfirmReview());

    expect(confirm.fired).toEqual([
      {
        input: {
          id: 'client-cooklog-1',
          recipeId: 'recipe-1',
          pantryId: 'pantry-1',
          deductFromPantry: true,
          exactStacks: true,
          servings: 2,
          notes: 'Halved it',
          ingredientsUsed: [
            expect.objectContaining({
              recipeIngredientId: 'ing-1',
              pantryItemId: 'pi-1',
              actualQuantity: 1,
            }),
          ],
        },
        stacksFirst: 100,
      },
    ]);
    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Deducted 1 ingredient from pantry',
    );
  });

  describe('the saved recipe after a cook', () => {
    const COOKED_AT = '2026-10-13T18:30:00.000Z';

    /** What the detail screen reads of the saved recipe, as the cache holds it. */
    const readSavedDetails = (cache: InMemoryCache) =>
      cache.readFragment({
        id: cache.identify({ __typename: 'Recipe', id: 'recipe-1' }),
        fragment: UseRecipeData_RecipeFragmentDoc,
        fragmentName: 'useRecipeData_recipe',
        returnPartialData: true,
      })?.savedDetails;

    it('shows the cooked count and the last-cooked date the cook returns', async () => {
      const cache = seedCache([
        {
          __typename: 'Recipe',
          id: 'recipe-1',
          savedDetails: {
            __typename: 'SavedRecipe',
            id: 'saved-1',
            cookedCount: 2,
            lastCookedAt: null,
          },
        },
      ]);
      expect(readSavedDetails(cache)).toMatchObject({
        cookedCount: 2,
        lastCookedAt: null,
      });
      const cooked = recordMock(MarkRecipeAsCookedDocument, {
        data: {
          markRecipeAsCooked: {
            __typename: 'MarkRecipeAsCookedPayload',
            recipe: {
              id: 'recipe-1',
              savedDetails: {
                id: 'saved-1',
                cookedCount: 3,
                lastCookedAt: COOKED_AT,
              },
            },
          },
        },
      });
      const { result } = renderCooking([cooked.mock], cache);

      await cook(result, { deductFromPantry: false });

      await drainTimers();
      expect(readSavedDetails(cache)).toMatchObject({
        cookedCount: 3,
        lastCookedAt: COOKED_AT,
      });
    });
  });
});

// 6.1: the recipe's page and a planned meal open one cook; COOK-01's 2-serving
// recipe cooked for 4 proposes the same draws from either.
describe('useRecipeCookingActions — from a recipe or from its planned meal', () => {
  const matchesFor4 = () =>
    recordMock(MatchRecipeIngredientsToPantryDocument, {
      data: {
        matchRecipeIngredientsToPantry: [
          {
            matchKind: RecipeIngredientMatchKind.Item,
            isAvailable: true,
            availableQuantity: 12,
            suggestedQuantity: 4,
            suggestedUnit: { id: 'pc' },
            matchedPantryItem: { id: 'pi-1', unit: { id: 'pc' } },
            ingredient: { id: 'ing-eggs', isOptional: false },
          },
        ],
      },
    });

  async function reviewedCook(plannedMeal?: { id: string; version: number }) {
    const matches = matchesFor4();
    const confirm = cookedMock();
    const { result } = renderHookWithApollo(
      () => useRecipeCookingActions({ recipeId: 'recipe-1', plannedMeal }),
      { operationMocks: [matches.mock, confirm.mock] },
    );
    await cook(result, { servings: 4, useGranularDeduction: true });
    await drainTimers();
    const proposed = result.current.ingredientMatching.editableMatches.map(
      ({ adjustedQuantity, adjustedUnitId, selectedStack }) => ({
        adjustedQuantity,
        adjustedUnitId,
        stack: selectedStack?.id,
      }),
    );
    await drained(() => result.current.handleConfirmReview());
    return { matches, confirm, proposed };
  }

  it('proposes and sends the same draws, the planned one also naming its meal', async () => {
    const fromRecipe = await reviewedCook();
    const fromMeal = await reviewedCook({ id: 'mpi-1', version: 2 });

    expect(fromMeal.matches.fired).toEqual(fromRecipe.matches.fired);
    expect(fromMeal.proposed).toEqual(fromRecipe.proposed);
    expect(fromRecipe.proposed).toEqual([
      { adjustedQuantity: 4, adjustedUnitId: 'pc', stack: 'pi-1' },
    ]);
    const { mealPlanItemId, mealPlanItemVersion, ...cooked } = inputOf(
      fromMeal.confirm.fired[0]!,
    );
    expect({ mealPlanItemId, mealPlanItemVersion }).toEqual({
      mealPlanItemId: 'mpi-1',
      mealPlanItemVersion: 2,
    });
    expect(cooked).toEqual(inputOf(fromRecipe.confirm.fired[0]!));
    expect(inputOf(fromRecipe.confirm.fired[0]!)).not.toHaveProperty(
      'mealPlanItemId',
    );
  });

  it('a quick cook of a planned meal completes it in the same write', async () => {
    const confirm = cookedMock();
    const { result } = renderHookWithApollo(
      () =>
        useRecipeCookingActions({
          recipeId: 'recipe-1',
          plannedMeal: { id: 'mpi-1', version: 2 },
        }),
      { operationMocks: [confirm.mock] },
    );

    await cook(result, { deductFromPantry: false });
    await drainTimers();

    expect(inputOf(confirm.fired[0]!)).toMatchObject({
      recipeId: 'recipe-1',
      deductFromPantry: false,
      mealPlanItemId: 'mpi-1',
      mealPlanItemVersion: 2,
    });
  });
});
