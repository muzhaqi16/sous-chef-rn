import { toastService } from '#/services/toastService';
import type { InMemoryCache } from '@apollo/client';
import { act, waitFor } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import type {
  MockDataFor,
  MockedResponse,
  MockFor,
} from '#/test-utils/apolloMockProvider';
import {
  inputOf,
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import {
  CreateMealPlanItemDocument,
  UpdateMealPlanItemDocument,
  DeleteMealPlanItemDocument,
  GetMealPlanDocument,
} from '#features/mealPlan/graphql/mealPlan.generated';
import {
  ErrorCode,
  MealType,
  TopLevelErrorCode,
  type CreateMealPlanItemInput,
} from '#/graphql/generated/schemaTypes';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import { getVersionConflictMessage } from '#/utils/errors/versionConflict';
import { t } from '#/i18n';
import { readPlanSource } from '#features/mealPlan/cache/derivationSources';
import { MEAL_PLAN_ITEMS_FIELD } from '#features/mealPlan/cache/mealPlanItem';
import { MEALS_PAGE_SIZE } from '#features/mealPlan/utils/mealPlanPaging';
import { RECIPE_INGREDIENTS_PAGE_SIZE } from '#domain/recipeIngredientsPaging';
import {
  planSource,
  seedPlanSource,
} from '#/test-utils/fixtures/mealPlanFixtures';
import { useMealPlan } from '../useMealPlan';
import { useMealPlanItemActions } from '../useMealPlanItemActions';
import {
  MealPlanItemActions_OptimisticFullItemFragmentDoc,
  type MealPlanItemActions_OptimisticFullItemFragment,
} from '../useMealPlanItemActions.generated';
import type { Unmasked } from '@apollo/client/masking';

const PLAN_ID = 'plan-1';
const WEEK = { startDate: '2026-09-21', endDate: '2026-09-27' };

type FullItem = Unmasked<MealPlanItemActions_OptimisticFullItemFragment>;

/** A meal complete for the compound selection the actions read back. */
const fullItem = (overrides: Partial<FullItem> = {}): FullItem => ({
  __typename: 'MealPlanItem',
  id: 'mpi-1',
  version: 3,
  isCompleted: false,
  completedAt: null,
  servings: 1,
  notes: null,
  customMealName: null,
  calories: null,
  usedPantryItems: [],
  mealType: MealType.Dinner,
  date: '2026-09-22',
  recipe: {
    __typename: 'Recipe',
    id: 'r-1',
    name: 'Pasta',
    servings: 1,
    imageUrl: null,
    totalTimeMinutes: 0,
  },
  ...overrides,
});

const writeItem = (cache: InMemoryCache, item: FullItem) =>
  cache.writeFragment({
    id: cache.identify(item),
    fragment: MealPlanItemActions_OptimisticFullItemFragmentDoc,
    fragmentName: 'MealPlanItemActions_optimisticFullItem',
    data: item,
  });

const readItem = (cache: InMemoryCache, id: string = 'mpi-1') =>
  cache.readFragment({
    id: cache.identify({ __typename: 'MealPlanItem', id }),
    fragment: MealPlanItemActions_OptimisticFullItemFragmentDoc,
    fragmentName: 'MealPlanItemActions_optimisticFullItem',
  });

/** The plan's days, and its meals as edges of the list a loaded plan holds. */
const seedPlan = (
  meals: FullItem[] = [],
  bounds: { startDate: string; endDate: string } = WEEK,
): InMemoryCache => {
  const cache = seedPlanSource(
    planSource({ id: PLAN_ID, ...bounds, mealPlanItems: meals }),
  );
  for (const meal of meals) writeItem(cache, meal);
  return cache;
};

/** The plan's meals as a derived write reads them: [id, day]. */
const planMeals = (cache: InMemoryCache) =>
  readPlanSource(cache, PLAN_ID)?.mealPlanItems.map(meal => [
    meal.id,
    meal.date,
  ]);

/** The server creating the meal under the id the client minted, as it does. */
const createdAsSent = () =>
  recordMock(CreateMealPlanItemDocument, {
    dataFor: (vars): MockDataFor<typeof CreateMealPlanItemDocument> => ({
      createMealPlanItem: {
        __typename: 'CreateMealPlanItemPayload',
        mealPlanItem: {
          id: String(inputOf(vars).id),
          date: String(inputOf(vars).date),
        },
        // The plan's own fields come back too, and none of its lists.
        mealPlan: { id: String(inputOf(vars).mealPlanId), ...WEEK },
      },
    }),
  });

const DINNER: Omit<CreateMealPlanItemInput, 'date'> = {
  mealPlanId: PLAN_ID,
  meal: { recipeId: 'r-1' },
  mealType: MealType.Dinner,
};

/** A hand-built answer to `UpdateMealPlanItem`, recording what it was sent. */
function updateAnswering(
  result: MockFor<typeof UpdateMealPlanItemDocument>['result'],
) {
  const fired: Array<Record<string, unknown>> = [];
  const mock: MockFor<typeof UpdateMealPlanItemDocument> = {
    request: {
      query: UpdateMealPlanItemDocument,
      variables: vars => {
        fired.push(vars);
        return true;
      },
    },
    maxUsageCount: Number.POSITIVE_INFINITY,
    result,
  };
  return { fired, mock };
}

/** The actions beside the screen's own watcher of the plan, as on MealPlanMain. */
function usePlanAndActions() {
  useMealPlan(PLAN_ID);
  return useMealPlanItemActions(PLAN_ID);
}

const renderActions = (
  mocks: MockedResponse[],
  cache: InMemoryCache = makeCache(),
) =>
  renderHookWithApollo(() => useMealPlanItemActions(PLAN_ID), {
    operationMocks: mocks,
    cache,
  });

const mockToastSuccess = jest.mocked(toastService.success);
const mockToastError = jest.mocked(toastService.error);

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useMealPlanItemActions', () => {
  it('reports no create in flight initially', () => {
    const { result } = renderActions([]);

    expect(result.current.creating).toBe(false);
  });

  describe('createItem', () => {
    it('returns true on success, having sent the day as picked under a minted id', async () => {
      const create = createdAsSent();
      const cache = seedPlan([fullItem({ id: 'mpi-held' })]);
      const { result } = renderActions([create.mock], cache);

      let created!: Awaited<ReturnType<typeof result.current.createItem>>;
      await act(async () => {
        created = await result.current.createItem({
          ...DINNER,
          date: '2026-09-23',
        });
      });

      expect(created).toBe(true);
      expect(create.fired).toEqual([
        {
          input: {
            ...DINNER,
            date: '2026-09-23',
            id: expect.stringMatching(/^[a-z][0-9a-z]{23,31}$/),
          },
        },
      ]);
      const mintedId = String(inputOf(create.fired[0]!).id);
      // The answer restates the plan's own fields, not its meals: the list is
      // the edge writers', so the held meal stays and the new one follows it.
      expect(planMeals(cache)).toEqual([
        ['mpi-held', '2026-09-22'],
        [mintedId, '2026-09-23'],
      ]);
    });

    // Both ends are days of the plan: neither is moved.
    it.each(['2026-09-21', '2026-09-27'])(
      'sends a meal on %s, a boundary day of the plan, as that day',
      async day => {
        const create = createdAsSent();
        const { result } = renderActions([create.mock], seedPlan());

        await act(async () => {
          await result.current.createItem({ ...DINNER, date: day });
        });

        expect(inputOf(create.fired[0]!).date).toBe(day);
      },
    );

    // The API refuses a meal outside its plan's days.
    it.each([
      ['before the plan', '2026-09-20', '2026-09-21'],
      ['after the plan', '2026-09-30', '2026-09-27'],
    ])(
      'brings a day %s onto the nearest day of the plan',
      async (_label, picked, sent) => {
        const create = createdAsSent();
        const cache = seedPlan();
        const { result } = renderActions([create.mock], cache);

        await act(async () => {
          await result.current.createItem({ ...DINNER, date: picked });
        });

        expect(inputOf(create.fired[0]!).date).toBe(sent);
        // The row the user sees is on the day that was sent.
        expect(planMeals(cache)?.map(([, day]) => day)).toEqual([sent]);
      },
    );

    it('sends the picked day as it is when the plan is not in the cache', async () => {
      const create = createdAsSent();
      const { result } = renderActions([create.mock]);

      await act(async () => {
        await result.current.createItem({ ...DINNER, date: '2026-09-30' });
      });

      expect(inputOf(create.fired[0]!).date).toBe('2026-09-30');
    });

    it('puts the meal on the plan at version 1 while its create is queued', async () => {
      // The offline queue resolves a queued write with its payload field null.
      const create = recordMock(CreateMealPlanItemDocument, {
        data: { createMealPlanItem: null },
      });
      const cache = seedPlan([fullItem({ id: 'mpi-held' })]);
      const { result } = renderActions([create.mock], cache);

      let created: boolean | undefined;
      await act(async () => {
        created = await result.current.createItem({
          mealPlanId: PLAN_ID,
          meal: { customMealName: 'Leftovers' },
          mealType: MealType.Lunch,
          date: '2026-09-24',
          servings: 2,
        });
      });

      expect(created).toBe(true);
      const mintedId = String(inputOf(create.fired[0]!).id);
      // Appended as an edge: the plan's other meals stay.
      expect(planMeals(cache)).toEqual([
        ['mpi-held', '2026-09-22'],
        [mintedId, '2026-09-24'],
      ]);
      // What the server gives a new row, so an edit queued behind this create
      // has a version to state.
      expect(readItem(cache, mintedId)).toMatchObject({
        version: 1,
        date: '2026-09-24',
        mealType: MealType.Lunch,
        customMealName: 'Leftovers',
        servings: 2,
        isCompleted: false,
        recipe: null,
      });
      expect(mockToastError).not.toHaveBeenCalled();
    });

    it('shows one localized error toast, returns false and takes the meal back off the plan on failure', async () => {
      const create = recordMock(CreateMealPlanItemDocument, {
        data: {
          createMealPlanItem: {
            __typename: 'ConflictError',
            code: ErrorCode.Conflict,
            message: 'Conflict',
          },
        },
      });

      const cache = seedPlan([fullItem({ id: 'mpi-held' })]);
      const { result } = renderActions([create.mock], cache);

      let created!: Awaited<ReturnType<typeof result.current.createItem>>;
      await act(async () => {
        created = await result.current.createItem({
          ...DINNER,
          date: '2026-09-23',
        });
      });

      expect(created).toBe(false);
      // The app's copy for the code, never the server's `message`.
      expect(mockToastError).toHaveBeenCalledTimes(1);
      // `CONFLICT` is a state refusal, never "changed somewhere else".
      expect(mockToastError).not.toHaveBeenCalledWith(
        getVersionConflictMessage(),
      );
      expect(mockToastError).not.toHaveBeenCalledWith('Conflict');
      const mintedId = String(inputOf(create.fired[0]!).id);
      expect(planMeals(cache)).toEqual([['mpi-held', '2026-09-22']]);
      expect(cache.extract()[`MealPlanItem:${mintedId}`]).toBeUndefined();
    });
  });

  describe('toggleCompleted', () => {
    const completedAs = (version: number, isCompleted: boolean = true) =>
      recordMock(UpdateMealPlanItemDocument, {
        data: {
          updateMealPlanItem: {
            __typename: 'UpdateMealPlanItemPayload',
            mealPlanItem: { id: 'mpi-1', isCompleted, version },
          },
        },
      });

    it('marks the meal completed at the version the cache holds, and shows a toast', async () => {
      const update = completedAs(4);
      const cache = seedPlan([fullItem({ version: 3 })]);
      const { result } = renderActions([update.mock], cache);

      let toggled: boolean | undefined;
      await act(async () => {
        toggled = await result.current.toggleCompleted('mpi-1');
      });

      expect(toggled).toBe(true);
      expect(update.fired).toEqual([
        {
          input: {
            id: 'mpi-1',
            isCompleted: true,
            completedAt: expect.any(String),
            version: 3,
          },
        },
      ]);
      // The answer's version is the row's from here on.
      expect(readItem(cache)).toMatchObject({ isCompleted: true, version: 4 });
      expect(mockToastSuccess).toHaveBeenCalledWith('Meal completed!');
    });

    it('states what was cooked beside the version when marking complete', async () => {
      const update = completedAs(4);
      const cache = seedPlan([fullItem({ version: 3 })]);
      const { result } = renderActions([update.mock], cache);

      await act(async () => {
        await result.current.toggleCompleted('mpi-1', {
          deductFromPantry: true,
          servings: 3,
          notes: 'extra garlic',
        });
      });

      expect(update.fired).toEqual([
        {
          input: {
            id: 'mpi-1',
            isCompleted: true,
            completedAt: expect.any(String),
            deductFromPantry: true,
            servings: 3,
            notes: 'extra garlic',
            version: 3,
          },
        },
      ]);
    });

    it('shows deduction toast when deductFromPantry is true', async () => {
      const update = completedAs(4);
      const cache = seedPlan([fullItem()]);
      const { result } = renderActions([update.mock], cache);

      await act(async () => {
        await result.current.toggleCompleted('mpi-1', {
          deductFromPantry: true,
        });
      });

      expect(mockToastSuccess).toHaveBeenCalledWith(
        'Meal completed! Pantry items deducted.',
      );
    });

    it('un-completes at the cached version, without a toast', async () => {
      const update = completedAs(8, false);
      const cache = seedPlan([
        fullItem({
          isCompleted: true,
          completedAt: '2026-09-22T18:00:00.000Z',
          version: 7,
        }),
      ]);
      const { result } = renderActions([update.mock], cache);

      await act(async () => {
        await result.current.toggleCompleted('mpi-1');
      });

      expect(update.fired).toEqual([
        {
          input: {
            id: 'mpi-1',
            isCompleted: false,
            completedAt: null,
            version: 7,
          },
        },
      ]);
      expect(mockToastSuccess).not.toHaveBeenCalled();
    });

    /** The plan as the server reads it back, holding the one meal. */
    const planHolding = (meal: {
      version: number;
      notes?: string;
    }): MockDataFor<typeof GetMealPlanDocument> => ({
      mealPlan: {
        __typename: 'MealPlan',
        id: PLAN_ID,
        mealPlanItemsConnection: {
          edges: [
            {
              node: {
                __typename: 'MealPlanItem',
                id: 'mpi-1',
                isCompleted: false,
                completedAt: null,
                notes: null,
                ...meal,
              },
            },
          ],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    });

    const staleVersionRefusals: Array<
      [string, MockFor<typeof UpdateMealPlanItemDocument>['result']]
    > = [
      [
        'the VERSION_CONFLICT member',
        {
          data: {
            updateMealPlanItem: {
              __typename: 'ConflictError',
              code: ErrorCode.VersionConflict,
              message: 'raw server English',
            },
          },
        },
      ],
      [
        'a top-level RESOURCE_VERSION_CONFLICT',
        {
          data: null,
          errors: [
            {
              message: 'raw server English',
              extensions: {
                code: TopLevelErrorCode.ResourceVersionConflict,
              },
            },
          ],
        },
      ],
    ];

    // Another member changed the meal since it was read: theirs is shown.
    it.each(staleVersionRefusals)(
      'puts the meal back and re-reads the plan when refused with %s',
      async (_label, refusal) => {
        // The screen's own read, then the server's row after the other
        // member's edit.
        const screenRead = recordMock(GetMealPlanDocument, {
          data: planHolding({ version: 3 }),
          maxUsageCount: 1,
        });
        const reRead = recordMock(GetMealPlanDocument, {
          data: planHolding({ version: 4, notes: 'moved to Thursday' }),
        });
        const update = updateAnswering(refusal);
        const cache = makeCache();
        const { result } = renderHookWithApollo(usePlanAndActions, {
          operationMocks: [screenRead.mock, reRead.mock, update.mock],
          cache,
        });
        await waitFor(() => expect(readItem(cache)?.version).toBe(3));
        expect(reRead.fired).toHaveLength(0);

        let toggled: boolean | undefined;
        await act(async () => {
          toggled = await result.current.toggleCompleted('mpi-1');
        });

        expect(toggled).toBe(false);
        expect(update.fired).toEqual([
          {
            input: {
              id: 'mpi-1',
              isCompleted: true,
              completedAt: expect.any(String),
              version: 3,
            },
          },
        ]);
        expect(mockToastError).toHaveBeenCalledTimes(1);
        expect(mockToastError).toHaveBeenCalledWith(
          t('errors.changedElsewhereLatestShown'),
        );
        expect(mockToastSuccess).not.toHaveBeenCalled();
        await waitFor(() =>
          expect(reRead.fired).toEqual([
            {
              id: PLAN_ID,
              mealsFirst: MEALS_PAGE_SIZE,
              ingredientsFirst: RECIPE_INGREDIENTS_PAGE_SIZE,
            },
          ]),
        );
        await waitFor(() =>
          expect(readItem(cache)).toMatchObject({
            isCompleted: false,
            completedAt: null,
            version: 4,
            notes: 'moved to Thursday',
          }),
        );
      },
    );

    it('puts the meal back without re-reading the plan on any other refusal', async () => {
      const get = recordMock(GetMealPlanDocument, {
        data: planHolding({ version: 3 }),
      });
      const update = updateAnswering({
        data: {
          updateMealPlanItem: {
            __typename: 'ForbiddenError',
            code: ErrorCode.Forbidden,
            message: 'raw server English',
          },
        },
      });
      const cache = makeCache();
      const { result } = renderHookWithApollo(usePlanAndActions, {
        operationMocks: [get.mock, update.mock],
        cache,
      });
      await waitFor(() => expect(readItem(cache)?.version).toBe(3));

      let toggled: boolean | undefined;
      await act(async () => {
        toggled = await result.current.toggleCompleted('mpi-1');
      });

      expect(toggled).toBe(false);
      expect(readItem(cache)).toMatchObject({ isCompleted: false, version: 3 });
      expect(mockToastError).toHaveBeenCalledTimes(1);
      expect(get.fired).toHaveLength(1);
    });
  });

  describe('deleteItem', () => {
    const deleted = (held = false) =>
      recordMock(DeleteMealPlanItemDocument, {
        data: {
          deleteMealPlanItem: {
            __typename: 'DeleteMealPlanItemPayload',
            mealPlanItem: { id: 'mpi-1' },
          },
        },
        held,
      });

    it('claims the row against subscription echoes while the delete is in flight', async () => {
      // The subscription handler's isPendingDelete guard is only reachable
      // because this registers; without it a stale ITEM_ADDED for the same id
      // re-adds the meal after the optimistic removal.
      const claim = jest.spyOn(subscriptionService, 'registerPendingDelete');
      const del = deleted(true);

      const { result } = renderActions([del.mock]);

      let pending: Promise<unknown> | undefined;
      act(() => {
        pending = result.current.deleteItem('mpi-1');
      });

      await waitFor(() =>
        expect(subscriptionService.isPendingDelete('mpi-1')).toBe(true),
      );
      // Named by the plan field the meal's edge hangs off.
      expect(claim).toHaveBeenCalledWith(
        'mpi-1',
        PLAN_ID,
        'MealPlanItem',
        'MealPlan',
        MEAL_PLAN_ITEMS_FIELD,
      );
      expect(MEAL_PLAN_ITEMS_FIELD).toBe('mealPlanItemsConnection');

      await act(async () => {
        del.release();
        await pending;
      });

      // Released once the server has answered — the row is gone for good.
      expect(subscriptionService.isPendingDelete('mpi-1')).toBe(false);
    });

    it('takes the meal off the plan before the server answers, and returns true on success', async () => {
      const del = deleted(true);
      const cache = seedPlan([fullItem(), fullItem({ id: 'mpi-2' })]);
      const { result } = renderActions([del.mock], cache);

      let pending: Promise<boolean> | undefined;
      act(() => {
        pending = result.current.deleteItem('mpi-1');
      });
      // Local-first: gone at once, while the request is still in flight.
      expect(planMeals(cache)).toEqual([['mpi-2', '2026-09-22']]);

      let removed: boolean | undefined;
      await act(async () => {
        del.release();
        removed = await pending;
      });

      expect(removed).toBe(true);
      expect(del.fired).toEqual([{ input: { id: 'mpi-1' } }]);
      expect(planMeals(cache)).toEqual([['mpi-2', '2026-09-22']]);
      expect(readItem(cache)).toBeNull();
    });

    it('counts a meal that is already gone as deleted', async () => {
      const del = recordMock(DeleteMealPlanItemDocument, {
        data: {
          deleteMealPlanItem: {
            __typename: 'NotFoundError',
            code: ErrorCode.NotFound,
          },
        },
      });

      const cache = seedPlan([fullItem()]);
      const { result } = renderActions([del.mock], cache);

      let removed: boolean | undefined;
      await act(async () => {
        removed = await result.current.deleteItem('mpi-1');
      });

      expect(removed).toBe(true);
      expect(mockToastError).not.toHaveBeenCalled();
      expect(planMeals(cache)).toEqual([]);
    });

    it('returns false and puts the meal back on the plan on failure', async () => {
      const del = recordMock(DeleteMealPlanItemDocument, {
        data: {
          deleteMealPlanItem: {
            __typename: 'ForbiddenError',
            code: ErrorCode.Forbidden,
          },
        },
      });

      const cache = seedPlan([fullItem(), fullItem({ id: 'mpi-2' })]);
      const { result } = renderActions([del.mock], cache);

      let removed: boolean | undefined;
      await act(async () => {
        removed = await result.current.deleteItem('mpi-1');
      });

      expect(removed).toBe(false);
      expect(mockToastError).toHaveBeenCalledTimes(1);
      // Restored as an edge, complete for the screen's readers.
      expect(planMeals(cache)).toEqual(
        expect.arrayContaining([
          ['mpi-1', '2026-09-22'],
          ['mpi-2', '2026-09-22'],
        ]),
      );
      expect(planMeals(cache)).toHaveLength(2);
      expect(readItem(cache)).toMatchObject({ id: 'mpi-1', version: 3 });
    });
  });
});
