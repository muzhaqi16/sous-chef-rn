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
import { GetShoppingListsLiteDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { GetMealPlansDocument } from '#features/mealPlan/graphql/mealPlan.generated';
import { GetPantryDocument } from '#features/pantry/graphql/pantry.generated';
import { PAGE_SIZE } from '#features/pantry/constants/pagination';
import { makeCache } from '#/apollo/cache';
import { todayKey } from '#/utils/dateUtils';
import { useStore } from '#store';
import { connectionOf } from '#/test-utils/fixtures/connectionOf';

let mockIsOnline = true;
let mockReady = true;
jest.mock('#store/useAppStore', () => ({
  useIsOnline: () => mockIsOnline,
  useIsPantryQueryComplete: () => mockReady,
  useAppStore: (selector: (s: unknown) => unknown) =>
    selector({ hasInitializedHomeData: mockReady }),
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

  it('does not fire a doomed request while offline', async () => {
    mockIsOnline = false;
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
});
