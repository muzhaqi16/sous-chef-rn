/**
 * `HomeTabs` sets `lazy: true`, so a tab the user never opened while online
 * never ran its query and had nothing cached — on device, Pantry rendered 63
 * items with no network while Shopping List said "Not available offline".
 *
 * The fix warms the data without mounting the tab. Two things make it correct
 * rather than merely present:
 *   - variables identical to the consuming hooks, or the warm populates a
 *     different cache entry and buys nothing;
 *   - it must not fire while offline, where the request is doomed.
 *
 * Run against the real Apollo cache rather than a mocked client, so the test
 * proves data actually lands where the tab will later read it.
 */
import {
  renderHookWithApollo,
  recordMock,
} from '#/test-utils/apolloMockProvider';
import { useOfflineTabPreloading } from '#bootstrap/useOfflineTabPreloading';
import {
  GetShoppingListDetailsDocument,
  GetShoppingListItemsFilteredDocument,
  GetShoppingListsLiteDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { GetMealPlansDocument } from '#features/mealPlan/graphql/mealPlan.generated';
import { GetPantryDocument } from '#features/pantry/graphql/pantry.generated';
import { PAGE_SIZE } from '#features/pantry/constants/pagination';
import { makeCache } from '#/apollo/cache';
import { addDaysToKey, todayKey } from '#/utils/dateUtils';
import { MOBILE_WARM_TARGETS } from '#/app/mobileWarmTargets';
import { drainTimers } from '#/test-utils/drainTimers';
import { GetMealPlanDocument } from '#features/mealPlan/screens/useMealPlan.generated';
import { GetRecipeDocument } from '#features/recipes/graphql/recipe.generated';
import { MEALS_PAGE_SIZE } from '#features/mealPlan/utils/mealPlanPaging';
import { RECIPE_INGREDIENTS_PAGE_SIZE } from '#domain/recipeIngredientsPaging';
import { useStore } from '#store';
import { connectionOf } from '#/test-utils/fixtures/connectionOf';

let mockIsOnline = true;
let mockApiReachable: boolean | null = true;
let mockReady = true;
jest.mock('#store/useAppStore', () => ({
  useIsPantryQueryComplete: () => mockReady,
  useAppStore: (selector: (s: unknown) => unknown) =>
    selector({
      hasInitializedHomeData: mockReady,
      isOnline: mockIsOnline,
      apiReachable: mockApiReachable,
    }),
}));

jest.mock('#/services/errorService');

/** Drains the idle callback the hook schedules, plus the awaited queries. */
async function flushWarm() {
  jest.runAllTimers();
  for (let i = 0; i < 8; i++) {
    await Promise.resolve();
  }
}

describe('useOfflineTabPreloading', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockIsOnline = true;
    mockApiReachable = true;
    mockReady = true;
  });
  afterEach(() => {
    jest.useRealTimers();
    useStore.setState({ selectedPantryId: null });
  });

  it('warms both tab queries with the consuming hooks variables', async () => {
    const lists = recordMock(GetShoppingListsLiteDocument, {});
    const plans = recordMock(GetMealPlansDocument, {});

    renderHookWithApollo(() => useOfflineTabPreloading(), {
      operationMocks: [lists.mock, plans.mock],
    });
    await flushWarm();

    // `useShoppingListsQuery` asks for exactly this.
    expect(lists.fired).toContainEqual(expect.objectContaining({ first: 50 }));
    // `MealPlanMain` calls `useMealPlans()` with no filters.
    expect(plans.fired).toContainEqual(expect.objectContaining({ first: 20 }));
  });

  it.each([
    ['no connection', false, null],
    ['the API down on working Wi-Fi', true, false],
  ])('fires no doomed request with %s', async (_cause, isOnline, reachable) => {
    mockIsOnline = isOnline;
    mockApiReachable = reachable;
    const lists = recordMock(GetShoppingListsLiteDocument, {});

    renderHookWithApollo(() => useOfflineTabPreloading(), {
      operationMocks: [lists.mock],
    });
    await flushWarm();

    expect(lists.fired).toHaveLength(0);
  });

  it('waits for first-paint data before warming', async () => {
    mockReady = false;
    const lists = recordMock(GetShoppingListsLiteDocument, {});

    renderHookWithApollo(() => useOfflineTabPreloading(), {
      operationMocks: [lists.mock],
    });
    await flushWarm();

    expect(lists.fired).toHaveLength(0);
  });

  it('warms once per session, not on every render', async () => {
    const lists = recordMock(GetShoppingListsLiteDocument, {});
    const plans = recordMock(GetMealPlansDocument, {});

    const { rerender } = renderHookWithApollo(() => useOfflineTabPreloading(), {
      operationMocks: [lists.mock, plans.mock],
    });
    await flushWarm();
    const firstCount = lists.fired.length;

    rerender({});
    await flushWarm();

    expect(lists.fired.length).toBe(firstCount);
  });

  it('runs again when the API comes back after a warm that failed', async () => {
    const lists = recordMock(GetShoppingListsLiteDocument, {
      error: new Error('the API blinked'),
      maxUsageCount: 1,
    });
    const retried = recordMock(GetShoppingListsLiteDocument, {
      data: { shoppingLists: connectionOf([]) },
    });

    const { rerender } = renderHookWithApollo(() => useOfflineTabPreloading(), {
      operationMocks: [lists.mock, retried.mock],
    });
    await jest.runAllTimersAsync();
    expect(lists.fired).toHaveLength(1);

    mockApiReachable = false;
    rerender({});
    mockApiReachable = true;
    rerender({});
    await jest.runAllTimersAsync();

    expect(retried.fired).toHaveLength(1);
  });

  it('still warms when an outage cancelled it before it ran', async () => {
    const lists = recordMock(GetShoppingListsLiteDocument, {});

    const { rerender } = renderHookWithApollo(() => useOfflineTabPreloading(), {
      operationMocks: [lists.mock],
    });
    mockApiReachable = false;
    rerender({});
    await jest.runAllTimersAsync();
    expect(lists.fired).toHaveLength(0);

    mockApiReachable = true;
    rerender({});
    await jest.runAllTimersAsync();

    expect(lists.fired).toHaveLength(1);
  });

  // Today is the tab a launch mounts, so nothing else loads Pantry's list.
  it("warms the selected pantry with the Pantry screen's client-mode variables", async () => {
    useStore.setState({ selectedPantryId: 'p1' });
    const pantry = recordMock(GetPantryDocument, {});

    renderHookWithApollo(() => useOfflineTabPreloading(), {
      operationMocks: [
        pantry.mock,
        recordMock(GetShoppingListsLiteDocument, {}).mock,
        recordMock(GetMealPlansDocument, {}).mock,
      ],
    });
    await flushWarm();

    // `usePantryScreen` reads unfiltered, in API order, one page of the max.
    expect(pantry.fired).toEqual([
      {
        id: 'p1',
        itemsFirst: PAGE_SIZE.MAX,
        storageLocationsFirst: PAGE_SIZE.COMPACT,
        today: todayKey(),
      },
    ]);
  });

  // Each warm awaits the last, so the responses land over several timer turns.
  it('sends nothing for a launch whose cache already holds every tab', async () => {
    useStore.setState({ selectedPantryId: 'p1' });
    const cache = makeCache();
    // Answered under the id it was asked for, as the server does.
    const pantry = recordMock(GetPantryDocument, {
      dataFor: vars => ({ pantry: { id: String(vars.id) } }),
    });
    const lists = recordMock(GetShoppingListsLiteDocument, {
      data: { shoppingLists: connectionOf([]) },
    });
    const plans = recordMock(GetMealPlansDocument, {
      data: { mealPlans: connectionOf([]) },
    });
    const mocks = [pantry.mock, lists.mock, plans.mock];

    const first = renderHookWithApollo(() => useOfflineTabPreloading(), {
      operationMocks: mocks,
      cache,
    });
    await jest.runAllTimersAsync();
    first.unmount();
    expect(pantry.fired).toHaveLength(1);

    renderHookWithApollo(() => useOfflineTabPreloading(), {
      operationMocks: mocks,
      cache,
    });
    await jest.runAllTimersAsync();

    expect(pantry.fired).toHaveLength(1);
    expect(lists.fired).toHaveLength(1);
    expect(plans.fired).toHaveLength(1);
  });

  describe('what the lists name', () => {
    const HOST = MOBILE_WARM_TARGETS;
    const today = todayKey();
    const planOf = (id: string, fromDay: number, toDay: number) => ({
      id,
      startDate: addDaysToKey(today, fromDay),
      endDate: addDaysToKey(today, toDay),
    });
    const planAnswers = (
      meals: Record<string, Array<Record<string, unknown>>>,
    ) =>
      recordMock(GetMealPlanDocument, {
        dataFor: vars => ({
          mealPlan: {
            id: String(vars.id),
            mealPlanItemsConnection: connectionOf(meals[String(vars.id)] ?? []),
          },
        }),
      });
    const mealOn = (day: number, recipeId: string) => ({
      id: `meal-${recipeId}`,
      date: addDaysToKey(today, day),
      customMealName: null,
      recipe: { id: recipeId },
    });
    const recipeAnswers = () =>
      recordMock(GetRecipeDocument, {
        dataFor: vars => ({ recipe: { id: String(vars.id) } }),
      });
    const noList = () => recordMock(GetShoppingListsLiteDocument, {});

    it('holds the active list and both tabs of its items', async () => {
      const cache = makeCache();
      const lists = recordMock(GetShoppingListsLiteDocument, {
        data: {
          shoppingLists: connectionOf([{ id: 'sl-1', isDefault: true }]),
        },
      });
      const details = recordMock(GetShoppingListDetailsDocument, {
        dataFor: vars => ({ shoppingList: { id: String(vars.id) } }),
      });
      const items = recordMock(GetShoppingListItemsFilteredDocument, {
        dataFor: vars => ({
          shoppingList: {
            id: String(vars.id),
            itemsConnection: connectionOf([]),
          },
        }),
      });

      renderHookWithApollo(() => useOfflineTabPreloading(), {
        cache,
        operationMocks: [lists.mock, details.mock, items.mock],
      });
      await drainTimers();

      expect(details.fired).toEqual([{ id: 'sl-1' }]);
      expect(items.fired).toEqual([
        { id: 'sl-1', first: 25, isPurchased: false },
        { id: 'sl-1', first: 25, isPurchased: true },
      ]);
      expect(
        cache.readQuery({
          query: GetShoppingListDetailsDocument,
          variables: { id: 'sl-1' },
        }),
      ).not.toBeNull();
    });

    it('holds the plan covering today and the next to start, and no other', async () => {
      const cache = makeCache();
      const plans = recordMock(GetMealPlansDocument, {
        data: {
          mealPlans: connectionOf([
            planOf('next', 2, 8),
            planOf('now', -1, 1),
            planOf('over', -30, -20),
          ]),
        },
      });
      const plan = planAnswers({});

      renderHookWithApollo(() => useOfflineTabPreloading(HOST), {
        cache,
        operationMocks: [noList().mock, plans.mock, plan.mock],
      });
      await drainTimers();

      expect(plan.fired.map(vars => vars.id).sort()).toEqual(['next', 'now']);
      expect(
        cache.readQuery({
          query: GetMealPlanDocument,
          variables: {
            id: 'next',
            mealsFirst: MEALS_PAGE_SIZE,
            ingredientsFirst: RECIPE_INGREDIENTS_PAGE_SIZE,
          },
        }),
      ).not.toBeNull();
    });

    it('holds the recipes planned for the coming week, soonest first, up to the cap', async () => {
      const cache = makeCache();
      const plans = recordMock(GetMealPlansDocument, {
        data: { mealPlans: connectionOf([planOf('now', -1, 30)]) },
      });
      const plan = planAnswers({
        now: [
          mealOn(-1, 'yesterday'),
          mealOn(8, 'next-week'),
          ...Array.from({ length: 20 }, (_, index) =>
            mealOn(index % 7, `r-${index}`),
          ),
        ],
      });
      const recipe = recipeAnswers();

      renderHookWithApollo(() => useOfflineTabPreloading(HOST), {
        cache,
        operationMocks: [noList().mock, plans.mock, plan.mock, recipe.mock],
      });
      await drainTimers();

      const asked = recipe.fired.map(vars => vars.id);
      expect(asked).toHaveLength(14);
      expect(asked).toEqual(expect.arrayContaining(['r-0', 'r-7', 'r-14']));
      expect(asked).not.toContain('yesterday');
      expect(asked).not.toContain('next-week');
      expect(
        cache.readQuery({
          query: GetRecipeDocument,
          variables: {
            id: 'r-0',
            ingredientsFirst: RECIPE_INGREDIENTS_PAGE_SIZE,
          },
        }),
      ).not.toBeNull();
    });

    it('sends nothing for what a launch already holds', async () => {
      const cache = makeCache();
      const plans = recordMock(GetMealPlansDocument, {
        data: { mealPlans: connectionOf([planOf('now', -1, 3)]) },
      });
      const plan = planAnswers({ now: [mealOn(0, 'r-1')] });
      const recipe = recipeAnswers();
      const lists = noList();
      const warm = () =>
        renderHookWithApollo(() => useOfflineTabPreloading(HOST), {
          cache,
          operationMocks: [lists.mock, plans.mock, plan.mock, recipe.mock],
        });
      warm();
      await drainTimers();
      const sent = recipe.fired.length + plan.fired.length;
      expect(sent).toBe(2);

      warm();
      await drainTimers();

      expect(recipe.fired.length + plan.fired.length).toBe(sent);
    });

    it('stops quietly when the lists it reads did not land', async () => {
      const plans = recordMock(GetMealPlansDocument, {
        error: new Error('Network request failed'),
      });
      const plan = planAnswers({});

      renderHookWithApollo(() => useOfflineTabPreloading(HOST), {
        operationMocks: [noList().mock, plans.mock, plan.mock],
      });
      await drainTimers();

      expect(plan.fired).toEqual([]);
    });
  });
});
