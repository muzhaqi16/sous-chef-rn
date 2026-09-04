import { waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
  seedCache,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { GetMealPlanDocument } from '#features/mealPlan/graphql/mealPlan.generated';
import { unconfirmedCreates } from '#/apollo/offline/unconfirmedCreates';
import { useStore } from '#store';
import { useActiveMealPlan } from '../useActiveMealPlan';
import { MealPlanDisplayFragmentDoc } from '#features/mealPlan/graphql/mealPlanFragments.generated';
/**
 * A plan complete for `MealPlanDisplay` — the selection every consumer reads.
 * These tests only need the entity to EXIST, but seeding it against the real
 * fragment is what keeps "in the cache" meaning the same thing here as in the app.
 */
const seedPlan = (id: string) =>
  seedCache([
    {
      fragment: MealPlanDisplayFragmentDoc,
      data: {
        __typename: 'MealPlan' as const,
        id,
        name: 'Camping Trip',
        description: null,
        planType: 'WEEKLY',
        startDate: '2025-06-15',
        endDate: '2025-06-21',
        servings: 1,
        totalCalories: null,
        totalProtein: null,
        totalCarbs: null,
        totalFat: null,
        actualCost: null,
        budgetAmount: null,
        homeId: 'h1',
        home: null,
        user: { __typename: 'User' as const, id: 'u1' },
        createdBy: null,
        version: 1,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
    },
  ]);

jest.mock('#/apollo/links/tokenScheduler');

/** A by-id miss: null data, no entry in `errors[]`. */
function missMock(id: string) {
  const fired: Array<Record<string, unknown>> = [];
  const mock: MockedResponse = {
    request: {
      query: GetMealPlanDocument,
      variables: vars => {
        if (vars.id !== id) return false;
        fired.push(vars);
        return true;
      },
    },
    maxUsageCount: Number.POSITIVE_INFINITY,
    result: { data: { mealPlan: null } },
  };
  return { fired, mock };
}

/** A row that exists and is not the caller's: a top-level FORBIDDEN. */
function forbiddenMock(id: string) {
  const fired: Array<Record<string, unknown>> = [];
  const mock: MockedResponse = {
    request: {
      query: GetMealPlanDocument,
      variables: vars => {
        if (vars.id !== id) return false;
        fired.push(vars);
        return true;
      },
    },
    maxUsageCount: Number.POSITIVE_INFINITY,
    result: {
      errors: [
        {
          message: `Access denied to meal plan ${id}`,
          extensions: { code: 'FORBIDDEN' },
        },
      ],
    },
  };
  return { fired, mock };
}

beforeEach(() => {
  useStore.setState({ selectedMealPlanId: null });
});

describe('useActiveMealPlan', () => {
  it('prefers the persisted selection over the current plan', () => {
    useStore.setState({ selectedMealPlanId: 'plan-picked' });
    const get = recordMock(GetMealPlanDocument, {
      error: new Error('network unavailable'),
    });

    const { result } = renderHookWithApollo(
      () =>
        useActiveMealPlan({
          currentPlanId: 'plan-current',
          planIds: ['plan-current', 'plan-picked'],
        }),
      { operationMocks: [get.mock] },
    );

    expect(result.current.activePlanId).toBe('plan-picked');
  });

  it('falls back when the selected plan reads back as null (deleted elsewhere)', async () => {
    useStore.setState({ selectedMealPlanId: 'plan-gone' });
    const gone = missMock('plan-gone');
    const fallback = recordMock(GetMealPlanDocument, {
      error: new Error('network unavailable'),
    });

    const { result } = renderHookWithApollo(
      () =>
        useActiveMealPlan({
          currentPlanId: 'plan-current',
          planIds: ['plan-current'],
        }),
      { operationMocks: [gone.mock, fallback.mock] },
    );

    await waitFor(() =>
      expect(result.current.activePlanId).toBe('plan-current'),
    );
    // The persisted pick is dropped, so the next cold start doesn't repeat it.
    expect(useStore.getState().selectedMealPlanId).toBeNull();
    expect(fallback.fired).toContainEqual({ id: 'plan-current' });
  });

  it('falls back when the selected plan answers FORBIDDEN (membership revoked)', async () => {
    useStore.setState({ selectedMealPlanId: 'plan-theirs' });
    const denied = forbiddenMock('plan-theirs');
    const fallback = recordMock(GetMealPlanDocument, {
      error: new Error('network unavailable'),
    });

    const { result } = renderHookWithApollo(
      () =>
        useActiveMealPlan({
          currentPlanId: 'plan-current',
          planIds: ['plan-current'],
        }),
      { operationMocks: [denied.mock, fallback.mock] },
    );

    await waitFor(() =>
      expect(result.current.activePlanId).toBe('plan-current'),
    );
    expect(useStore.getState().selectedMealPlanId).toBeNull();
  });

  it('evicts the dead plan so a persisted-cache hydrate cannot resurface it', async () => {
    useStore.setState({ selectedMealPlanId: 'plan-gone' });
    const cache = seedPlan('plan-gone');
    const gone = missMock('plan-gone');

    const { result } = renderHookWithApollo(
      () => useActiveMealPlan({ currentPlanId: null, planIds: [] }),
      { operationMocks: [gone.mock], cache },
    );

    await waitFor(() => expect(result.current.activePlanId).toBeNull());
    expect(cache.extract()['MealPlan:plan-gone']).toBeUndefined();
  });

  it('keeps a plan whose create has not been acknowledged', async () => {
    // Offline-first: null on a client-minted id means the create hasn't synced,
    // not that the plan is gone. Evicting here would delete queued work — so
    // useMealPlan never asks, and nothing reads a miss.
    useStore.setState({ selectedMealPlanId: 'plan-unsynced' });
    unconfirmedCreates.mark('plan-unsynced');
    const cache = seedPlan('plan-unsynced');
    const wouldMiss = missMock('plan-unsynced');

    const { result } = renderHookWithApollo(
      () =>
        useActiveMealPlan({
          currentPlanId: 'plan-current',
          planIds: ['plan-current'],
        }),
      { operationMocks: [wouldMiss.mock], cache },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(wouldMiss.fired).toHaveLength(0);
    expect(result.current.activePlanId).toBe('plan-unsynced');
    expect(useStore.getState().selectedMealPlanId).toBe('plan-unsynced');
    expect(cache.extract()['MealPlan:plan-unsynced']).toBeDefined();

    unconfirmedCreates.confirm('plan-unsynced');
  });

  it('keeps the selection when the read fails for a network reason', async () => {
    useStore.setState({ selectedMealPlanId: 'plan-picked' });
    const get = recordMock(GetMealPlanDocument, {
      error: new Error('Network request failed'),
    });

    const { result } = renderHookWithApollo(
      () =>
        useActiveMealPlan({
          currentPlanId: 'plan-current',
          planIds: ['plan-current'],
        }),
      { operationMocks: [get.mock] },
    );

    // Going offline must never read as a deletion.
    await waitFor(() =>
      expect(get.fired).toContainEqual({ id: 'plan-picked' }),
    );
    expect(result.current.activePlanId).toBe('plan-picked');
    expect(useStore.getState().selectedMealPlanId).toBe('plan-picked');
  });
});
