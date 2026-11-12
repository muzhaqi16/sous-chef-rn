import { useEffect } from 'react';
import { act } from '@testing-library/react-native';
import { useApolloClient } from '@apollo/client/react';
import type { InMemoryCache } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { useStore } from '#store';
import { resetSessionScopedStores } from '#store/sessionScopedStores';
import {
  recordMock,
  renderHookWithApollo,
  seedFragment,
  seedQuery,
} from '#/test-utils/apolloMockProvider';
import { withDeadline } from '#/test-utils/cacheWaits';
import { operationLog } from '#/test-utils/operationLog';
import { connectionOf } from '#/test-utils/fixtures/connectionOf';
import {
  homesData,
  type HomeFixture,
} from '#/test-utils/fixtures/homeFixtures';
import { memoryScreen } from '#/test-utils/memoryPlatform';
import { MealType } from '#/graphql/generated/schemaTypes';
import { GetHomesDocument } from '#operations/home/home.generated';
import { GetMealPlansDocument } from '#features/mealPlan/graphql/mealPlan.generated';
import {
  CurrentMealPlanDocument,
  GetMealPlanDocument,
} from '#features/mealPlan/screens/useMealPlan.generated';
import { RecipeSuggestionsDocument } from '#features/recipes/hooks/useServerRecipeSuggestions.generated';
import { GetShoppingListsLiteDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { PantryReadersFragmentDoc } from '#/graphql/readers/pantryReaders.generated';
import { useFeatureFlag } from '#hooks/settings/useFeatureFlag';
import { TodayCountsDocument } from '../useTodayOverview.generated';
import { useTodayOverview } from '../useTodayOverview';

const TODAY = '2026-03-10';
// The device's date: the plans below are for it.
jest.mock('#hooks/app/useToday', () => ({ useToday: () => '2026-03-10' }));
// A build flag: on unless a case switches it off.
jest.mock('#hooks/settings/useFeatureFlag', () => ({
  useFeatureFlag: jest.fn(() => true),
}));

const KITCHEN_HOME: HomeFixture = {
  id: 'h1',
  name: 'Test Home',
  isDefault: true,
  pantries: [{ id: 'p1', name: 'Kitchen', isDefault: true }],
};
/** The same home once its only pantry is gone. */
const BARE_HOME: HomeFixture = { ...KITCHEN_HOME, pantries: [] };

const COOK = {
  id: 'u1',
  email: 'cook@example.com',
  emailVerified: true,
  onBoarded: true,
};

let log = operationLog();

interface Household {
  /** The homes the device holds, or none read yet: the homes read is cache-only. */
  homes?: HomeFixture[] | 'unread';
  selectedHomeId?: string | null;
  selectedPantryId?: string | null;
  /** Whether the start-up has settled which home is selected. */
  ready?: boolean;
}

function holding({
  homes = [KITCHEN_HOME],
  selectedHomeId = 'h1',
  selectedPantryId = 'p1',
  ready = true,
}: Household = {}) {
  const cache = makeCache();
  if (homes !== 'unread') {
    seedQuery(cache, { query: GetHomesDocument, data: homesData(homes) });
  }
  useStore.setState({
    selectedHomeId,
    selectedPantryId,
    isHomeSelectionReady: ready,
  });
  return cache;
}

const stats = (totalItems: number, expired: number, expiring: number) => ({
  totalItems,
  expiredCount: expired,
  expiringCount: expiring,
  lowStockCount: 0,
});

const countsMock = (pantryStats = stats(9, 6, 3)) =>
  recordMock(TodayCountsDocument, {
    dataFor: vars => ({
      pantry: { id: String(vars.id), stats: pantryStats },
    }),
  });

const failedCounts = () =>
  recordMock(TodayCountsDocument, {
    error: new Error('Network request failed'),
  });

const PLAN = { id: 'mp1', startDate: '2026-03-09', endDate: '2026-03-15' };

const MEALS = connectionOf([
  {
    id: 'mi1',
    date: TODAY,
    mealType: MealType.Dinner,
    customMealName: null,
    recipe: { id: 'r1', name: 'Shakshuka' },
  },
  {
    id: 'mi2',
    date: '2026-03-11',
    mealType: MealType.Lunch,
    customMealName: null,
    recipe: { id: 'r2', name: 'Soup' },
  },
]);

/** The server naming the plan covering today; without it, the list decides. */
const currentPlanMock = ({ none = false, fails = false, held = false } = {}) =>
  fails
    ? recordMock(CurrentMealPlanDocument, {
        error: new Error('Network request failed'),
      })
    : recordMock(CurrentMealPlanDocument, {
        held,
        data: {
          currentMealPlan: none
            ? null
            : { ...PLAN, mealPlanItemsConnection: MEALS },
        },
      });

const plansMock = (withPlan = true) =>
  recordMock(GetMealPlansDocument, {
    data: { mealPlans: connectionOf(withPlan ? [PLAN] : []) },
  });

const planMock = () =>
  recordMock(GetMealPlanDocument, {
    data: { mealPlan: { ...PLAN, mealPlanItemsConnection: MEALS } },
  });

const suggestionsMock = (count = 5) =>
  recordMock(RecipeSuggestionsDocument, {
    data: {
      recipeSuggestions: {
        edges: Array.from({ length: count }, (_, index) => ({
          coverage: 80,
          expiringStacks: [],
          node: { id: `s${index + 1}`, name: `Recipe ${index + 1}` },
        })),
      },
    },
  });

const listsMock = (withList = true) =>
  recordMock(GetShoppingListsLiteDocument, {
    data: {
      shoppingLists: connectionOf(
        withList
          ? [
              {
                id: 'l1',
                name: 'Weekly',
                isDefault: true,
                totalItems: 12,
                completedItems: 7,
              },
            ]
          : [],
      ),
    },
  });

/** An empty household: nothing stocked, planned or listed, unless a case says. */
const nothingHeld = ({
  counts = countsMock(stats(0, 0, 0)),
  lists = listsMock(false),
} = {}) => [
  counts,
  currentPlanMock({ none: true }),
  plansMock(false),
  suggestionsMock(0),
  lists,
];

type Overview = ReturnType<typeof useTodayOverview>;
const renderListeners = new Set<(overview: Overview) => void>();

function renderOverview(
  mocks: ReturnType<typeof recordMock>[] = [
    countsMock(),
    currentPlanMock(),
    plansMock(),
    planMock(),
    suggestionsMock(),
    listsMock(),
  ],
  cache: InMemoryCache = holding(),
) {
  return renderHookWithApollo(
    () => {
      const overview = useTodayOverview();
      const client = useApolloClient();
      // Told of every committed render, before `result.current` is updated.
      useEffect(() => {
        for (const listener of [...renderListeners]) listener(overview);
      });
      return { overview, client };
    },
    {
      cache,
      links: [log.link],
      operationMocks: mocks.map(recorded => recorded.mock),
    },
  );
}

/** Waits for a render whose overview satisfies `ok`, inside `act`. */
async function shows(
  result: { current: { overview: Overview } },
  ok: (overview: Overview) => boolean,
) {
  await act(async () => {
    await withDeadline(
      done => {
        const check = (overview: Overview) => {
          if (ok(overview)) done();
        };
        renderListeners.add(check);
        check(result.current.overview);
        return () => renderListeners.delete(check);
      },
      () =>
        `the overview never showed it; it last read ${JSON.stringify(
          result.current.overview,
        ).slice(0, 400)}`,
    );
  });
}

/** Waits for each read to land, in turn. */
const landed = async (...documents: Parameters<typeof log.landed>[0][]) => {
  for (const document of documents) await log.landed(document);
};

beforeEach(() => {
  jest.restoreAllMocks();
  log = operationLog();
  renderListeners.clear();
  resetSessionScopedStores();
  useStore.setState({ user: COOK, isOnline: true, apiReachable: true });
  jest.mocked(useFeatureFlag).mockReturnValue(true);
});

afterEach(() => {
  act(() => memoryScreen().setFocused(true));
});

it("reads the current pantry's counts for today", async () => {
  const counts = countsMock();
  const { result } = renderOverview([
    counts,
    currentPlanMock(),
    plansMock(),
    suggestionsMock(),
    listsMock(),
  ]);

  await landed(TodayCountsDocument);

  expect(result.current.overview.counts).toEqual({
    expired: 6,
    expiring: 3,
    lowStock: 0,
    total: 9,
  });
  expect(counts.fired).toEqual([{ id: 'p1', today: TODAY }]);
  expect(result.current.overview.householdName).toBe('Test Home');
});

it("lists only today's meals, each with its meal type and recipe", async () => {
  const { result } = renderOverview();

  await shows(result, overview => overview.meals.length > 0);

  expect(result.current.overview.meals).toHaveLength(1);
  expect(result.current.overview.meals[0]).toMatchObject({
    id: 'mi1',
    mealTypeLabel: 'Dinner',
    recipeId: 'r1',
  });
});

it('previews no suggestions with pantry suggestions switched off', async () => {
  jest.mocked(useFeatureFlag).mockReturnValue(false);
  const suggestions = suggestionsMock();
  const { result } = renderOverview([
    countsMock(),
    currentPlanMock(),
    plansMock(),
    suggestions,
    listsMock(),
  ]);

  await landed(TodayCountsDocument, GetShoppingListsLiteDocument);

  expect(suggestions.fired).toHaveLength(0);
  expect(result.current.overview.suggestions).toEqual({
    items: [],
    loading: false,
    fromPantry: false,
  });
});

// The server owns this flag, so it can switch off while Today is open; the
// read then stops, but keeps its last rows.
it('drops the suggestions it shows once they are switched off', async () => {
  const { result, rerender } = renderOverview();
  await landed(RecipeSuggestionsDocument);
  expect(result.current.overview.suggestions.items).toHaveLength(3);

  jest.mocked(useFeatureFlag).mockReturnValue(false);
  rerender({});

  expect(result.current.overview.suggestions.items).toEqual([]);
});

it('asks every section again on a pull to refresh, and spins until all answer', async () => {
  const counts = countsMock();
  const plans = plansMock();
  const suggestions = suggestionsMock();
  const lists = listsMock();
  const { result } = renderOverview([
    counts,
    currentPlanMock(),
    plans,
    planMock(),
    suggestions,
    lists,
  ]);
  await landed(
    TodayCountsDocument,
    GetMealPlansDocument,
    RecipeSuggestionsDocument,
    GetShoppingListsLiteDocument,
  );
  await shows(result, overview => overview.meals.length > 0);
  const reads = [counts, plans, suggestions, lists];
  const before = reads.map(mock => mock.fired.length);

  act(() => result.current.overview.refresh());

  expect(result.current.overview.refreshing).toBe(true);
  await shows(result, overview => !overview.refreshing);
  reads.forEach((mock, index) => {
    expect(mock.fired.length).toBeGreaterThan(before[index] ?? 0);
  });
});

it("reads the plan once, with the server's answer for today, when the list answers first", async () => {
  const current = currentPlanMock({ held: true });
  const plan = planMock();
  const { result } = renderOverview([
    countsMock(),
    current,
    plansMock(),
    plan,
    suggestionsMock(),
    listsMock(),
  ]);
  await landed(GetMealPlansDocument);

  expect(result.current.overview.mealsState).toBe('loading');

  current.release();
  await landed(CurrentMealPlanDocument);
  await shows(result, overview => overview.meals.length > 0);

  expect(plan.fired).toHaveLength(0);
});

it('reads the plans and the plan again on a meals retry', async () => {
  const plan = planMock();
  const { result } = renderOverview([
    countsMock(),
    currentPlanMock(),
    plansMock(),
    plan,
    suggestionsMock(),
    listsMock(),
  ]);
  // The plan comes with the server's answer for today, so is not read alone.
  await landed(CurrentMealPlanDocument, GetMealPlansDocument);
  await shows(result, overview => overview.meals.length > 0);
  expect(plan.fired).toHaveLength(0);

  act(() => result.current.overview.retryMeals());

  await log.landed(GetMealPlansDocument, 2);
  await log.landed(GetMealPlanDocument);
});

it('is no first run when the lists could not be read', async () => {
  const { result } = renderOverview(
    nothingHeld({
      lists: recordMock(GetShoppingListsLiteDocument, {
        error: new Error('network down'),
      }),
    }),
  );

  await landed(TodayCountsDocument, GetMealPlansDocument);
  await landed(GetShoppingListsLiteDocument);

  expect(result.current.overview.state).toBe('ready');
});

it('is no first run while the homes list has no answer', async () => {
  const { result } = renderOverview(
    [plansMock(false), listsMock(false)],
    holding({ homes: 'unread', selectedHomeId: null, selectedPantryId: null }),
  );

  await landed(GetShoppingListsLiteDocument);

  expect(result.current.overview.needsHousehold).toBe(false);
  expect(['error', 'offline']).toContain(result.current.overview.state);
});

it('is not a first run while a list exists', async () => {
  const { result } = renderOverview(nothingHeld({ lists: listsMock() }));

  await landed(TodayCountsDocument, GetMealPlansDocument);
  await landed(GetShoppingListsLiteDocument);

  expect(result.current.overview.shopping).not.toBeNull();
  expect(result.current.overview.state).toBe('ready');
});

it('keeps no read running while another tab is in view', async () => {
  const { result } = renderOverview();
  await landed(TodayCountsDocument, GetShoppingListsLiteDocument);

  act(() => memoryScreen().setFocused(false));

  // A resync refetches every active query. The unread count is `cache-only`,
  // so it never reaches the network; nothing else of Today's may be active.
  const refetched = result.current.client.refetchQueries({ include: 'active' });
  expect(refetched.queries.map(query => query.queryName)).toEqual([
    'NotificationSummary',
  ]);
});

it('reads a pantry switched while hidden once Today is back in view, showing none of the last one', async () => {
  const counts = countsMock();
  const { result } = renderOverview(
    [counts, currentPlanMock(), plansMock(), suggestionsMock(), listsMock()],
    holding({
      homes: [
        {
          ...KITCHEN_HOME,
          pantries: [
            { id: 'p1', name: 'Kitchen', isDefault: true },
            { id: 'p2', name: 'Cellar' },
          ],
        },
      ],
    }),
  );
  await landed(TodayCountsDocument);

  act(() => memoryScreen().setFocused(false));
  await act(async () => {
    useStore.setState({ selectedPantryId: 'p2' });
  });

  expect(counts.fired).toHaveLength(1);
  expect(result.current.overview.counts).toBeNull();

  act(() => memoryScreen().setFocused(true));
  await log.landed(TodayCountsDocument, 2);

  expect(counts.fired).toEqual([
    { id: 'p1', today: TODAY },
    { id: 'p2', today: TODAY },
  ]);
  expect(result.current.overview.counts).not.toBeNull();
});

it('keeps its counts when a later read fails, never reading as offline', async () => {
  const answered = countsMock();
  const failed = failedCounts();
  const { result } = renderOverview([
    { ...answered, mock: { ...answered.mock, maxUsageCount: 1 } },
    failed,
    currentPlanMock(),
    plansMock(),
    suggestionsMock(),
    listsMock(),
  ]);
  await landed(TodayCountsDocument);
  expect(result.current.overview.state).toBe('ready');

  act(() => result.current.overview.retry());
  await log.landed(TodayCountsDocument, 2);

  expect(failed.fired).toHaveLength(1);
  expect(result.current.overview.state).toBe('ready');
  expect(result.current.overview.counts).toEqual({
    expired: 6,
    expiring: 3,
    lowStock: 0,
    total: 9,
  });
});

it("follows the pantry's stats when another tab's write moves them", async () => {
  const counts = countsMock();
  const { result } = renderOverview([
    counts,
    currentPlanMock(),
    plansMock(),
    suggestionsMock(),
    listsMock(),
  ]);
  await landed(TodayCountsDocument);
  expect(result.current.overview.counts?.expired).toBe(6);

  // What a consume's payload writes: the pantry's readers, stats included.
  act(() => {
    seedFragment(result.current.client.cache, {
      fragment: PantryReadersFragmentDoc,
      fragmentName: 'PantryReaders',
      variables: { today: TODAY },
      data: {
        __typename: 'Pantry',
        id: 'p1',
        description: null,
        homeId: 'h1',
        isDefault: true,
        name: 'Kitchen',
        version: 2,
        stats: {
          __typename: 'PantryStats',
          ...stats(8, 5, 3),
          storageLocationCounts: [],
          storageStateCounts: {
            __typename: 'StorageStateCounts',
            ambient: 8,
            frozen: 0,
            none: 0,
            refrigerated: 0,
          },
        },
      },
    });
  });

  await shows(result, overview => overview.counts?.expired === 5);
  expect(counts.fired).toHaveLength(1);
});

it('reports a failed count read as a failure, never as an empty household', async () => {
  const counts = failedCounts();
  const { result } = renderOverview(nothingHeld({ counts }));

  await landed(TodayCountsDocument, GetMealPlansDocument);
  await landed(GetShoppingListsLiteDocument);

  expect(counts.fired).toHaveLength(1);
  expect(['error', 'offline']).toContain(result.current.overview.state);
});

describe('a home with no pantry', () => {
  const pantryless = () =>
    holding({ homes: [BARE_HOME], selectedPantryId: null });

  it('settles with its meals and no counts', async () => {
    const { result } = renderOverview(
      [currentPlanMock(), plansMock(), suggestionsMock(), listsMock()],
      pantryless(),
    );

    await shows(result, overview => overview.meals.length > 0);

    expect(result.current.overview.state).toBe('ready');
    expect(result.current.overview.counts).toBeNull();
  });

  it('asks for no counts on a retry', async () => {
    const counts = countsMock();
    const { result } = renderOverview(
      [counts, currentPlanMock(), plansMock(), suggestionsMock(), listsMock()],
      pantryless(),
    );
    await landed(GetShoppingListsLiteDocument);

    await act(async () => {
      result.current.overview.retry();
    });

    expect(counts.fired).toHaveLength(0);
  });

  // `skipToken` keeps the deleted pantry's last answer; it is not this home's.
  it('shows no counts once the pantry that had them is deleted', async () => {
    const { result } = renderOverview();
    await landed(TodayCountsDocument);
    expect(result.current.overview.counts).not.toBeNull();

    act(() => {
      seedQuery(result.current.client.cache, {
        query: GetHomesDocument,
        data: homesData([BARE_HOME]),
      });
    });

    await shows(result, overview => overview.counts === null);
    expect(result.current.overview.state).toBe('ready');
  });

  it('is a first run with no plans or lists either', async () => {
    const { result } = renderOverview(nothingHeld(), pantryless());

    await landed(GetMealPlansDocument, GetShoppingListsLiteDocument);

    expect(result.current.overview.state).toBe('empty');
  });

  it('is still loading while the home itself has not arrived', async () => {
    const { result } = renderOverview(
      nothingHeld(),
      holding({
        homes: [{ id: 'h2', name: 'Cabin', pantries: [] }],
        selectedPantryId: null,
      }),
    );

    await landed(GetMealPlansDocument, GetShoppingListsLiteDocument);

    expect(result.current.overview.state).toBe('loading');
  });
});

it('states how many homes the user is in once the selection settles, and null before', async () => {
  const ready = renderOverview(nothingHeld());
  expect(ready.result.current.overview.homeCount).toBe(1);
  ready.unmount();

  const settling = renderOverview(
    nothingHeld(),
    holding({ selectedHomeId: null, selectedPantryId: null, ready: false }),
  );
  expect(settling.result.current.overview.homeCount).toBeNull();
});

describe("when the server cannot name today's plan", () => {
  it('shows the plan covering today, not the one last opened on Meal Plan', async () => {
    useStore.setState({ selectedMealPlanId: 'mp-next' });
    const plans = recordMock(GetMealPlansDocument, {
      data: {
        mealPlans: connectionOf([
          { id: 'mp-next', startDate: '2026-03-16', endDate: '2026-03-22' },
          PLAN,
        ]),
      },
    });
    const { result } = renderOverview([
      countsMock(),
      currentPlanMock({ fails: true }),
      plans,
      planMock(),
      suggestionsMock(),
      listsMock(),
    ]);

    await shows(result, overview => overview.meals.length > 0);

    expect(result.current.overview.meals).toHaveLength(1);
    expect(result.current.overview.meals[0]?.id).toBe('mi1');
  });

  it('plans nothing for today when no plan covers it', async () => {
    const OLD_PLAN = {
      id: 'mp-old',
      startDate: '2026-03-01',
      endDate: '2026-03-07',
    };
    const plan = recordMock(GetMealPlanDocument, {
      data: {
        mealPlan: {
          ...OLD_PLAN,
          mealPlanItemsConnection: connectionOf([
            {
              id: 'mi-old',
              date: '2026-03-05',
              mealType: MealType.Dinner,
              customMealName: null,
              recipe: { id: 'r1', name: 'Shakshuka' },
            },
          ]),
        },
      },
    });
    const { result } = renderOverview([
      countsMock(),
      currentPlanMock({ fails: true }),
      recordMock(GetMealPlansDocument, {
        data: { mealPlans: connectionOf([OLD_PLAN]) },
      }),
      plan,
      suggestionsMock(),
      listsMock(),
    ]);

    await landed(GetMealPlanDocument);

    expect(plan.fired).toHaveLength(1);
    expect(result.current.overview.meals).toEqual([]);
  });

  it('reads the plan once when the day’s list answers after it', async () => {
    const oldPlan = {
      id: 'mp-old',
      startDate: '2026-03-01',
      endDate: '2026-03-07',
    };
    const list = recordMock(GetMealPlansDocument, {
      data: { mealPlans: connectionOf([oldPlan]) },
      match: vars => !vars.filters,
    });
    const daysList = recordMock(GetMealPlansDocument, {
      data: { mealPlans: connectionOf([oldPlan]) },
      match: vars => !!vars.filters,
      held: true,
    });
    const plan = recordMock(GetMealPlanDocument, {
      data: {
        mealPlan: { ...oldPlan, mealPlanItemsConnection: connectionOf([]) },
      },
    });
    renderOverview([
      countsMock(),
      currentPlanMock({ fails: true }),
      list,
      daysList,
      plan,
      suggestionsMock(),
      listsMock(),
    ]);
    await landed(GetMealPlanDocument);

    daysList.release();
    await log.landed(GetMealPlansDocument, 2);

    expect(plan.fired).toHaveLength(1);
  });

  it('says the meals cannot be read offline when the plan is listed but not held', async () => {
    useStore.setState({ apiReachable: false });
    const { result } = renderOverview([
      countsMock(),
      currentPlanMock({ fails: true }),
      plansMock(),
      recordMock(GetMealPlanDocument, {
        error: new Error('Network request failed'),
      }),
      suggestionsMock(),
      listsMock(),
    ]);

    await landed(GetMealPlanDocument);

    expect(result.current.overview.meals).toEqual([]);
    expect(result.current.overview.mealsState).toBe('offline');
  });
});

it('reads the meals as ready once the plan covering today is held', async () => {
  const { result } = renderOverview();

  await shows(result, overview => overview.meals.length > 0);

  expect(result.current.overview.mealsState).toBe('ready');
});

describe("a new day's counts", () => {
  /** Yesterday's counts, as a cold start restores them: `stats` has no day in its key. */
  function holdingYesterdaysCounts() {
    const cache = holding();
    seedQuery(cache, {
      query: TodayCountsDocument,
      variables: { id: 'p1', today: '2026-03-09' },
      data: {
        __typename: 'Query',
        pantry: {
          __typename: 'Pantry',
          version: 1,
          id: 'p1',
          stats: { __typename: 'PantryStats', ...stats(9, 1, 3) },
        },
      },
    });
    return cache;
  }

  it('are confirmed with the server once, then answered from the cache', async () => {
    const counts = countsMock(stats(9, 6, 3));
    const { result } = renderOverview(
      [counts, currentPlanMock(), plansMock(), suggestionsMock(), listsMock()],
      holdingYesterdaysCounts(),
    );

    await landed(TodayCountsDocument);
    expect(result.current.overview.counts?.expired).toBe(6);
    expect(counts.fired).toEqual([{ id: 'p1', today: TODAY }]);

    act(() => memoryScreen().setFocused(false));
    act(() => memoryScreen().setFocused(true));
    await act(async () => undefined);

    expect(counts.fired).toHaveLength(1);
    expect(result.current.overview.counts?.expired).toBe(6);
  });

  it('show the last counts held when the server cannot answer', async () => {
    const counts = failedCounts();
    const { result } = renderOverview(
      [counts, currentPlanMock(), plansMock(), suggestionsMock(), listsMock()],
      holdingYesterdaysCounts(),
    );

    await landed(TodayCountsDocument);

    expect(counts.fired).toHaveLength(1);
    expect(result.current.overview.state).toBe('ready');
    expect(result.current.overview.counts?.expired).toBe(1);
  });
});
