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
import { useOfflineTabPreloading } from '#/app/useOfflineTabPreloading';
import { GetShoppingListsLiteDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { GetMealPlansDocument } from '#features/mealPlan/graphql/mealPlan.generated';

let mockIsOnline = true;
let mockReady = true;
jest.mock('#store/useAppStore', () => ({
  useIsOnline: () => mockIsOnline,
  useIsPantryQueryComplete: () => mockReady,
  useAppStore: (selector: (s: unknown) => unknown) =>
    selector({ hasInitializedHomeData: mockReady }),
}));

jest.mock('#/services/errorService', () => ({
  errorService: { reportError: jest.fn() },
}));

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
  afterEach(() => jest.useRealTimers());

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
});
