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
    const cache = seedCache([
      { __typename: 'MealPlan', id: 'plan-gone', name: 'Camping Trip' },
    ]);
    const gone = missMock('plan-gone');

    const { result } = renderHookWithApollo(
      () => useActiveMealPlan({ currentPlanId: null, planIds: [] }),
      { operationMocks: [gone.mock], cache },
    );

    await waitFor(() => expect(result.current.activePlanId).toBeNull());
    expect(cache.extract()['MealPlan:plan-gone']).toBeUndefined();
  });

  it('treats a marked plan id as any other — the marker is inert here', async () => {
    // Creating a plan is online-only now, so a client-minted id is never
    // unacknowledged and a miss means the plan is genuinely gone. The marker
    // used to suppress the read; asserting it no longer does is what stops a
    // deleted plan staying selected forever if something marks an id again.
    useStore.setState({ selectedMealPlanId: 'plan-unsynced' });
    unconfirmedCreates.mark('plan-unsynced');
    const cache = seedCache([
      { __typename: 'MealPlan', id: 'plan-unsynced', name: 'Camping Trip' },
    ]);
    const miss = missMock('plan-unsynced');

    const { result } = renderHookWithApollo(
      () =>
        useActiveMealPlan({
          currentPlanId: 'plan-current',
          planIds: ['plan-current'],
        }),
      { operationMocks: [miss.mock], cache },
    );

    // Evicted like any other gone plan, and the selection falls through to the
    // one plan that is left rather than to nothing.
    await waitFor(() =>
      expect(result.current.activePlanId).toBe('plan-current'),
    );
    expect(miss.fired).toContainEqual({ id: 'plan-unsynced' });
    expect(cache.extract()['MealPlan:plan-unsynced']).toBeUndefined();

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
