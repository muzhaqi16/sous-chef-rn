import { act, waitFor } from '@testing-library/react-native';
import { useApolloClient } from '@apollo/client/react';
import type { InMemoryCache } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { useStore } from '#store';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { connectionOf } from '#/test-utils/fixtures/connectionOf';
import { memoryScreen } from '#/test-utils/memoryPlatform';
import { MealType } from '#/graphql/generated/schemaTypes';
import { GetMealPlansDocument } from '#features/mealPlan/graphql/mealPlan.generated';
import { GetMealPlanDocument } from '#features/mealPlan/screens/useMealPlan.generated';
import { RecipeSuggestionsDocument } from '#features/recipes/hooks/useServerRecipeSuggestions.generated';
import { GetShoppingListsLiteDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { PantryReadersFragmentDoc } from '#/graphql/readers/pantryReaders.generated';
import { useCurrentPantry } from '#features/pantry/hooks/useCurrentPantry';
import { useFeatureFlag } from '#hooks/settings/useFeatureFlag';
import { TodayCountsDocument } from '../useTodayOverview.generated';
import { useTodayOverview } from '../useTodayOverview';

const TODAY = '2026-03-10';
jest.mock('#hooks/app/useToday', () => ({ useToday: () => '2026-03-10' }));
jest.mock('#hooks/auth/useIsLoggedOut', () => ({
  useIsLoggedOut: () => false,
}));
jest.mock('#hooks/apollo/useApolloErrorLogger', () => ({
  useApolloErrorLogger: jest.fn(),
}));
jest.mock('#hooks/settings/useFeatureFlag', () => ({
  useFeatureFlag: jest.fn(),
}));
jest.mock('#features/pantry/hooks/useCurrentPantry', () => ({
  useCurrentPantry: jest.fn(),
}));

const mockedFlag = jest.mocked(useFeatureFlag);
const mockedCurrentPantry = jest.mocked(useCurrentPantry);

type CurrentHome = NonNullable<
  ReturnType<typeof useCurrentPantry>['currentHome']
>;
// The overview reads only the household's name.
const testHome = { id: 'h1', name: 'Test Home' } as CurrentHome;

function inHousehold(pantryId: string | null) {
  const pantry = pantryId
    ? { id: pantryId, name: 'Kitchen', isDefault: true }
    : null;
  mockedCurrentPantry.mockReturnValue({
    pantry,
    pantries: pantry ? [{ __typename: 'Pantry', ...pantry }] : [],
    setSelectedPantryId: jest.fn(),
    currentHome: pantryId ? testHome : undefined,
    selectedHomeId: pantryId ? 'h1' : null,
    homeCount: pantryId ? 1 : 0,
    isReady: true,
  });
}

/** A selected home with no pantry: its details loaded, or still on their way. */
function inHouseholdWithoutPantry({ homeLoaded }: { homeLoaded: boolean }) {
  mockedCurrentPantry.mockReturnValue({
    pantry: null,
    pantries: [],
    setSelectedPantryId: jest.fn(),
    currentHome: homeLoaded ? testHome : undefined,
    selectedHomeId: 'h1',
    homeCount: 1,
    isReady: true,
  });
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

const plansMock = (withPlan = true) =>
  recordMock(GetMealPlansDocument, {
    data: {
      mealPlans: connectionOf(
        withPlan
          ? [{ id: 'mp1', startDate: '2026-03-09', endDate: '2026-03-15' }]
          : [],
      ),
    },
  });

const planMock = () =>
  recordMock(GetMealPlanDocument, {
    data: {
      mealPlan: {
        id: 'mp1',
        startDate: '2026-03-09',
        endDate: '2026-03-15',
        mealPlanItemsConnection: connectionOf([
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
        ]),
      },
    },
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

function renderOverview(
  mocks: ReturnType<typeof recordMock>[] = [
    countsMock(),
    plansMock(),
    planMock(),
    suggestionsMock(),
    listsMock(),
  ],
  cache?: InMemoryCache,
) {
  return renderHookWithApollo(
    () => ({ overview: useTodayOverview(), client: useApolloClient() }),
    {
      operationMocks: mocks.map(recorded => recorded.mock),
      ...(cache && { cache }),
    },
  );
}

beforeEach(() => {
  inHousehold('p1');
  mockedFlag.mockReturnValue(true);
});

afterEach(() => {
  act(() => memoryScreen().setFocused(true));
});

it("reads the current pantry's counts for today", async () => {
  const counts = countsMock();
  const { result } = renderOverview([
    counts,
    plansMock(),
    planMock(),
    suggestionsMock(),
    listsMock(),
  ]);

  await waitFor(() =>
    expect(result.current.overview.counts).toEqual({
      expired: 6,
      expiring: 3,
      lowStock: 0,
    }),
  );
  expect(counts.fired).toEqual([{ id: 'p1', today: TODAY }]);
  expect(result.current.overview.householdName).toBe('Test Home');
});

it("lists only today's meals, each with its meal type and recipe", async () => {
  const { result } = renderOverview();

  await waitFor(() => expect(result.current.overview.meals).toHaveLength(1));
  expect(result.current.overview.meals[0]).toMatchObject({
    id: 'mi1',
    mealTypeLabel: 'Dinner',
    recipeId: 'r1',
  });
});

it("previews the first three of Recipes' pantry suggestions, in order", async () => {
  const { result } = renderOverview();

  await waitFor(() =>
    expect(result.current.overview.suggestions.items).toHaveLength(3),
  );
  expect(result.current.overview.suggestions.fromPantry).toBe(true);
  expect(result.current.overview.suggestions.items.map(s => s.title)).toEqual([
    'Recipe 1',
    'Recipe 2',
    'Recipe 3',
  ]);
});

it('previews no suggestions with pantry suggestions switched off', async () => {
  mockedFlag.mockReturnValue(false);
  const suggestions = suggestionsMock();
  const { result } = renderOverview([
    countsMock(),
    plansMock(),
    planMock(),
    suggestions,
    listsMock(),
  ]);

  await waitFor(() => expect(result.current.overview.counts).not.toBeNull());
  expect(suggestions.fired).toHaveLength(0);
  expect(result.current.overview.suggestions).toEqual({
    items: [],
    loading: false,
    fromPantry: false,
  });
});

it('asks every section again on a pull to refresh, and spins until all answer', async () => {
  const counts = countsMock();
  const plans = plansMock();
  const plan = planMock();
  const suggestions = suggestionsMock();
  const lists = listsMock();
  const { result } = renderOverview([counts, plans, plan, suggestions, lists]);
  await waitFor(() => expect(result.current.overview.meals).toHaveLength(1));
  await waitFor(() =>
    expect(result.current.overview.suggestions.items).toHaveLength(3),
  );
  const before = [counts, plans, plan, suggestions, lists].map(
    mock => mock.fired.length,
  );

  act(() => result.current.overview.refresh());

  expect(result.current.overview.refreshing).toBe(true);
  await waitFor(() => expect(result.current.overview.refreshing).toBe(false));
  // At least once more each: a plans answer can re-run the plan's read too.
  [counts, plans, plan, suggestions, lists].forEach((mock, index) => {
    expect(mock.fired.length).toBeGreaterThan(before[index] ?? 0);
  });
});

it('summarizes the active list as the items left to buy', async () => {
  const { result } = renderOverview();

  await waitFor(() =>
    expect(result.current.overview.shopping).toEqual({
      id: 'l1',
      name: 'Weekly',
      itemsLeft: 5,
    }),
  );
});

it('is a first run for an empty pantry with no plan or list', async () => {
  const { result } = renderOverview([
    countsMock(stats(0, 0, 0)),
    plansMock(false),
    suggestionsMock(0),
    listsMock(false),
  ]);

  await waitFor(() => expect(result.current.overview.state).toBe('empty'));
});

it('is a first run with no household', () => {
  inHousehold(null);
  const { result } = renderOverview([plansMock(false), listsMock(false)]);

  expect(result.current.overview.state).toBe('empty');
});

it('is not a first run while a list exists', async () => {
  const { result } = renderOverview([
    countsMock(stats(0, 0, 0)),
    plansMock(false),
    suggestionsMock(0),
    listsMock(),
  ]);

  await waitFor(() => expect(result.current.overview.shopping).not.toBeNull());
  expect(result.current.overview.state).toBe('ready');
});

it('keeps no read running while another tab is in view', async () => {
  const { result } = renderOverview();
  await waitFor(() => expect(result.current.overview.shopping).not.toBeNull());

  act(() => memoryScreen().setFocused(false));

  // A resync refetches every active query. The unread count is `cache-only`,
  // so it never reaches the network; nothing else of Today's may be active.
  const refetched = result.current.client.refetchQueries({
    include: 'active',
  });
  expect(refetched.queries.map(query => query.queryName)).toEqual([
    'NotificationSummary',
  ]);
});

it('reads a pantry switched while hidden once Today is back in view', async () => {
  const counts = countsMock();
  const { result, rerender } = renderOverview([
    counts,
    plansMock(),
    planMock(),
    suggestionsMock(),
    listsMock(),
  ]);
  await waitFor(() => expect(counts.fired).toHaveLength(1));

  act(() => memoryScreen().setFocused(false));
  inHousehold('p2');
  rerender({});
  expect(counts.fired).toHaveLength(1);

  act(() => memoryScreen().setFocused(true));
  await waitFor(() =>
    expect(counts.fired).toEqual([
      { id: 'p1', today: TODAY },
      { id: 'p2', today: TODAY },
    ]),
  );
  await waitFor(() => expect(result.current.overview.counts).not.toBeNull());
});

it('keeps its counts when a later read fails, never reading as offline', async () => {
  const answered = countsMock();
  const failed = recordMock(TodayCountsDocument, {
    error: new Error('Network request failed'),
  });
  const { result } = renderOverview([
    { ...answered, mock: { ...answered.mock, maxUsageCount: 1 } },
    failed,
    plansMock(),
    planMock(),
    suggestionsMock(),
    listsMock(),
  ]);
  await waitFor(() => expect(result.current.overview.state).toBe('ready'));

  await act(async () => {
    result.current.overview.retry();
  });

  await waitFor(() => expect(failed.fired).toHaveLength(1));
  expect(result.current.overview.state).toBe('ready');
  expect(result.current.overview.counts).toEqual({
    expired: 6,
    expiring: 3,
    lowStock: 0,
  });
});

it("follows the pantry's stats when another tab's write moves them", async () => {
  const counts = countsMock();
  const { result } = renderOverview([
    counts,
    plansMock(),
    planMock(),
    suggestionsMock(),
    listsMock(),
  ]);
  await waitFor(() => expect(result.current.overview.counts?.expired).toBe(6));

  // What a consume's payload writes: the pantry's readers, stats included.
  act(() => {
    result.current.client.cache.writeFragment({
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

  await waitFor(() => expect(result.current.overview.counts?.expired).toBe(5));
  expect(counts.fired).toHaveLength(1);
});

it('reports a failed count read as a failure, never as an empty household', async () => {
  const counts = recordMock(TodayCountsDocument, {
    error: new Error('Network request failed'),
  });
  const { result } = renderOverview([
    counts,
    plansMock(false),
    suggestionsMock(0),
    listsMock(false),
  ]);

  await waitFor(() => expect(counts.fired).toHaveLength(1));
  await waitFor(() =>
    expect(['error', 'offline']).toContain(result.current.overview.state),
  );
});

describe('a home with no pantry', () => {
  it('settles with its meals and no counts', async () => {
    inHouseholdWithoutPantry({ homeLoaded: true });
    const { result } = renderOverview([
      plansMock(),
      planMock(),
      suggestionsMock(),
      listsMock(),
    ]);

    await waitFor(() => expect(result.current.overview.meals).toHaveLength(1));
    expect(result.current.overview.state).toBe('ready');
    expect(result.current.overview.counts).toBeNull();
  });

  // `skipToken` keeps the deleted pantry's last answer; it is not this home's.
  it('shows no counts once the pantry that had them is deleted', async () => {
    const { result, rerender } = renderOverview();
    await waitFor(() => expect(result.current.overview.counts).not.toBeNull());

    inHouseholdWithoutPantry({ homeLoaded: true });
    rerender({});

    await waitFor(() => expect(result.current.overview.counts).toBeNull());
    expect(result.current.overview.state).toBe('ready');
  });

  it('is a first run with no plans or lists either', async () => {
    inHouseholdWithoutPantry({ homeLoaded: true });
    const { result } = renderOverview([
      plansMock(false),
      suggestionsMock(0),
      listsMock(false),
    ]);

    await waitFor(() => expect(result.current.overview.state).toBe('empty'));
  });

  it('states how many homes the user is in once the homes have loaded, and null before', async () => {
    inHousehold('p1');
    const ready = renderOverview([
      plansMock(false),
      suggestionsMock(0),
      listsMock(false),
    ]);
    expect(ready.result.current.overview.homeCount).toBe(1);

    mockedCurrentPantry.mockReturnValue({
      pantry: null,
      pantries: [],
      setSelectedPantryId: jest.fn(),
      currentHome: null,
      selectedHomeId: null,
      homeCount: 0,
      isReady: false,
    });
    const loading = renderOverview([
      plansMock(false),
      suggestionsMock(0),
      listsMock(false),
    ]);
    expect(loading.result.current.overview.homeCount).toBeNull();
    await act(() => new Promise(resolve => setTimeout(resolve, 0)));
  });

  it('is still loading while the home itself has not arrived', async () => {
    inHouseholdWithoutPantry({ homeLoaded: false });
    const { result } = renderOverview([
      plansMock(false),
      suggestionsMock(0),
      listsMock(false),
    ]);

    await act(() => new Promise(resolve => setTimeout(resolve, 0)));
    expect(result.current.overview.state).toBe('loading');
  });
});

it('shows the plan covering today, not the one last opened on Meal Plan', async () => {
  useStore.setState({ selectedMealPlanId: 'mp-next' });
  const plans = recordMock(GetMealPlansDocument, {
    data: {
      mealPlans: connectionOf([
        { id: 'mp-next', startDate: '2026-03-16', endDate: '2026-03-22' },
        { id: 'mp1', startDate: '2026-03-09', endDate: '2026-03-15' },
      ]),
    },
  });
  const { result } = renderOverview([
    countsMock(),
    plans,
    planMock(),
    suggestionsMock(),
    listsMock(),
  ]);

  await waitFor(() => expect(result.current.overview.meals).toHaveLength(1));
  expect(result.current.overview.meals[0]?.id).toBe('mi1');
  useStore.setState({ selectedMealPlanId: null });
});

it('plans nothing for today when no plan covers it', async () => {
  const plans = recordMock(GetMealPlansDocument, {
    data: {
      mealPlans: connectionOf([
        { id: 'mp-old', startDate: '2026-03-01', endDate: '2026-03-07' },
      ]),
    },
  });
  const plan = recordMock(GetMealPlanDocument, {
    data: {
      mealPlan: {
        id: 'mp-old',
        startDate: '2026-03-01',
        endDate: '2026-03-07',
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
    plans,
    plan,
    suggestionsMock(),
    listsMock(),
  ]);

  await waitFor(() => expect(plan.fired).toHaveLength(1));
  await act(() => new Promise(resolve => setTimeout(resolve, 0)));
  expect(result.current.overview.meals).toEqual([]);
});

describe("a new day's counts", () => {
  /** Yesterday's counts, as a cold start restores them: `stats` has no day in its key. */
  function cacheWithYesterdaysCounts() {
    const cache = makeCache();
    cache.writeQuery({
      query: TodayCountsDocument,
      variables: { id: 'p1', today: '2026-03-09' },
      data: {
        __typename: 'Query',
        pantry: {
          __typename: 'Pantry',
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
      [counts, plansMock(), planMock(), suggestionsMock(), listsMock()],
      cacheWithYesterdaysCounts(),
    );

    await waitFor(() =>
      expect(result.current.overview.counts?.expired).toBe(6),
    );
    expect(counts.fired).toEqual([{ id: 'p1', today: TODAY }]);

    act(() => memoryScreen().setFocused(false));
    act(() => memoryScreen().setFocused(true));
    await act(() => new Promise(resolve => setTimeout(resolve, 0)));
    expect(counts.fired).toHaveLength(1);
    expect(result.current.overview.counts?.expired).toBe(6);
  });

  it('show the last counts held when the server cannot answer', async () => {
    const counts = recordMock(TodayCountsDocument, {
      error: new Error('Network request failed'),
    });
    const { result } = renderOverview(
      [counts, plansMock(), planMock(), suggestionsMock(), listsMock()],
      cacheWithYesterdaysCounts(),
    );

    await waitFor(() => expect(counts.fired).toHaveLength(1));
    expect(result.current.overview.state).toBe('ready');
    expect(result.current.overview.counts?.expired).toBe(1);
  });
});
