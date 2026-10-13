'use no memo';
import { act, waitFor } from '@testing-library/react-native';
import type { MockDataFor } from '#/test-utils/apolloMockProvider';
import {
  recordMock,
  renderHookWithApollo,
  seedCache,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { GetMealPlansDocument } from '#features/mealPlan/graphql/mealPlan.generated';
import { SortOrder } from '#/graphql/generated/schemaTypes';
import { MealPlanDisplayFragmentDoc } from '#features/mealPlan/graphql/mealPlanFragments.generated';
import { addDaysToKey } from '#/utils/dateUtils';
import { useMealPlans } from '../useMealPlans';

function seedPlanCache(
  plans: Array<{ id: string; startDate: string; endDate: string }>,
) {
  return seedCache(
    plans.map(p => ({
      // The production selection `useMealPlans` reads back, so a thin fixture
      // fails here instead of defining its own idea of complete.
      fragment: MealPlanDisplayFragmentDoc,
      data: {
        __typename: 'MealPlan',
        id: p.id,
        name: `Plan ${p.id}`,
        description: null,
        planType: 'WEEKLY',
        startDate: p.startDate,
        endDate: p.endDate,
        servings: 1,
        totalCalories: null,
        totalProtein: null,
        totalCarbs: null,
        totalFat: null,
        actualCost: null,
        budgetAmount: null,
        homeId: 'h1',
        home: null,
        user: { __typename: 'User', id: `u-${p.id}` },
        createdBy: null,
        version: 1,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
    })),
  );
}

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

// The device's calendar day, pinned: every plan below is dated against it.
const TODAY = '2026-03-10';
const YESTERDAY = '2026-03-09';
const TOMORROW = '2026-03-11';
jest.mock('#hooks/useToday', () => ({ useToday: () => '2026-03-10' }));

jest.mock('#hooks/auth/useIsLoggedOut', () => ({
  useIsLoggedOut: () => false,
}));
jest.mock('#hooks/apollo/useApolloErrorLogger', () => ({
  useApolloErrorLogger: jest.fn(),
}));

jest.mock('#/utils/finallyHelpers', () => ({
  executeMutation: jest.fn(<T>(fn: () => Promise<T>) => fn()),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

function planConnection(
  plans: Array<{ id: string; startDate: string; endDate: string }>,
): MockDataFor<typeof GetMealPlansDocument> {
  return {
    mealPlans: {
      __typename: 'MealPlanConnection',
      edges: plans.map(p => ({
        __typename: 'MealPlanEdge',
        cursor: p.id,
        node: {
          __typename: 'MealPlan',
          ...p,
        },
      })),
      totalCount: plans.length,
      pageInfo: {
        __typename: 'PageInfo',
        hasNextPage: false,
        endCursor: null,
      },
    },
  };
}

function planData(
  plans: Array<{ id: string; startDate: string; endDate: string }>,
): MockedResponse {
  return recordMock(GetMealPlansDocument, {
    data: planConnection(plans),
  }).mock;
}

function emptyMock(): MockedResponse {
  const data: MockDataFor<typeof GetMealPlansDocument> = { mealPlans: null };
  return recordMock(GetMealPlansDocument, {
    data,
  }).mock;
}

describe('useMealPlans', () => {
  it('returns empty mealPlans when no data', async () => {
    const { result } = renderHookWithApollo(() => useMealPlans(), {
      operationMocks: [emptyMock()],
    });
    await waitFor(() => expect(result.current.state.loading).toBe(false));
    expect(result.current.state.mealPlans).toEqual([]);
  });

  it('returns mealPlans from query data', async () => {
    const plan = { id: '1', startDate: TODAY, endDate: TODAY };
    const { result } = renderHookWithApollo(() => useMealPlans(), {
      operationMocks: [planData([plan])],
      cache: seedPlanCache([plan]),
    });
    await waitFor(() => expect(result.current.state.mealPlans).toHaveLength(1));
    expect(result.current.state.mealPlans[0]!.id).toBe('1');
  });

  it('identifies active plan as current', async () => {
    const activePlan = {
      id: 'active',
      startDate: YESTERDAY,
      endDate: TOMORROW,
    };
    const { result } = renderHookWithApollo(() => useMealPlans(), {
      operationMocks: [planData([activePlan])],
      cache: seedPlanCache([activePlan]),
    });
    await waitFor(() =>
      expect(result.current.state.currentPlan?.id).toBe('active'),
    );
  });

  // A plan's last day is one of its days: it is current until that day ends.
  it.each([
    ['its last day', { startDate: '2026-03-04', endDate: TODAY }],
    ['its first day', { startDate: TODAY, endDate: '2026-03-16' }],
    ['the one day of a one-day plan', { startDate: TODAY, endDate: TODAY }],
  ])(
    'keeps a plan current on %s, over one starting tomorrow',
    async (_label, days) => {
      const plans = [
        { id: 'upcoming', startDate: TOMORROW, endDate: '2026-03-17' },
        { id: 'today', ...days },
      ];
      const { result } = renderHookWithApollo(() => useMealPlans(), {
        operationMocks: [planData(plans)],
        cache: seedPlanCache(plans),
      });

      await waitFor(() =>
        expect(result.current.state.mealPlans).toHaveLength(2),
      );
      expect(result.current.state.currentPlan?.id).toBe('today');
    },
  );

  it('takes the upcoming plan as current once the other ended yesterday', async () => {
    const plans = [
      { id: 'upcoming', startDate: TOMORROW, endDate: '2026-03-17' },
      { id: 'ended', startDate: '2026-03-03', endDate: YESTERDAY },
    ];
    const { result } = renderHookWithApollo(() => useMealPlans(), {
      operationMocks: [planData(plans)],
      cache: seedPlanCache(plans),
    });

    await waitFor(() =>
      expect(result.current.state.currentPlan?.id).toBe('upcoming'),
    );
  });

  it("follows a plan's own edit, which leaves the list query's result as it was", async () => {
    const plan = { id: 'active', startDate: YESTERDAY, endDate: TOMORROW };
    const cache = seedPlanCache([plan]);
    const { result } = renderHookWithApollo(() => useMealPlans(), {
      operationMocks: [planData([plan])],
      cache,
    });
    await waitFor(() =>
      expect(result.current.state.currentPlan?.id).toBe('active'),
    );

    await act(async () => {
      cache.updateFragment(
        {
          fragment: MealPlanDisplayFragmentDoc,
          fragmentName: 'MealPlanDisplay',
          id: cache.identify({ __typename: 'MealPlan', id: 'active' }),
        },
        cached => (cached ? { ...cached, name: 'Renamed' } : cached),
      );
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(result.current.state.currentPlan?.name).toBe('Renamed'),
    );
    expect(result.current.state.mealPlans[0]?.name).toBe('Renamed');
  });

  // Resolving the current plan needs the few plans that can overlap today, not
  // a second full page of display nodes on every mount.
  it('asks for only the plans that can overlap today', async () => {
    const recorded = recordMock(GetMealPlansDocument, {
      data: {
        mealPlans: {
          __typename: 'MealPlanConnection',
          edges: [],
          totalCount: 0,
          pageInfo: {
            __typename: 'PageInfo',
            hasNextPage: false,
            endCursor: null,
          },
        },
      },
    });
    renderHookWithApollo(() => useMealPlans(), {
      operationMocks: [recorded.mock, recorded.mock],
    });

    const isCurrentVariant = (variables: unknown) =>
      (variables as { filters?: { startDate?: string } }).filters?.startDate !==
      undefined;
    await waitFor(() =>
      expect(recorded.fired.some(isCurrentVariant)).toBe(true),
    );
    const currentVariant = recorded.fired.find(isCurrentVariant) as {
      first: number;
    };
    expect(currentVariant.first).toBeLessThanOrEqual(3);
  });

  // `filters.startDate` keeps plans ending on or after it: a day, so a plan on
  // its last day is not cut off at the hour the request happens to be sent.
  it('asks for the plans ending today or later by the day key, nearest first', async () => {
    const recorded = recordMock(GetMealPlansDocument, {
      data: planConnection([]),
    });
    renderHookWithApollo(() => useMealPlans(), {
      operationMocks: [recorded.mock],
    });

    await waitFor(() =>
      expect(recorded.fired).toContainEqual({
        first: 3,
        filters: { startDate: TODAY },
        orderBy: { startDate: SortOrder.Asc },
      }),
    );
  });

  describe('beyond the first page', () => {
    type Plan = { id: string; startDate: string; endDate: string };
    /** A week-long plan starting `startOffsetDays` from the pinned today. */
    const planAt = (id: string, startOffsetDays: number): Plan => ({
      id,
      startDate: addDaysToKey(TODAY, startOffsetDays),
      endDate: addDaysToKey(TODAY, startOffsetDays + 6),
    });
    const connection = (
      plans: Plan[],
      endCursor: string | null,
    ): MockDataFor<typeof GetMealPlansDocument> => ({
      mealPlans: {
        __typename: 'MealPlanConnection',
        edges: plans.map(p => ({
          __typename: 'MealPlanEdge',
          cursor: p.id,
          node: { __typename: 'MealPlan', ...p },
        })),
        pageInfo: {
          __typename: 'PageInfo',
          hasNextPage: endCursor !== null,
          endCursor,
        },
      },
    });

    // Page one (newest first) is twenty plans starting a year out or later.
    const farFuture = Array.from({ length: 20 }, (_, i) =>
      planAt(`future-${i}`, 400 - i),
    );
    const oldPlan = planAt('old', -300);
    const nearest = planAt('nearest', 3);

    const serverMock = () =>
      recordMock(GetMealPlansDocument, {
        dataFor: (vars): MockDataFor<typeof GetMealPlansDocument> => {
          const filters = vars.filters as { startDate?: string } | undefined;
          if (filters?.startDate)
            return connection([nearest, ...farFuture], null);
          if (vars.after === 'page-2') return connection([oldPlan], null);
          return connection(farFuture, 'page-2');
        },
      });

    it('reaches a plan on the second page through loadMore', async () => {
      const server = serverMock();
      const { result } = renderHookWithApollo(() => useMealPlans(), {
        operationMocks: [server.mock],
      });
      await waitFor(() =>
        expect(result.current.state.mealPlans).toHaveLength(20),
      );
      expect(result.current.state.hasMore).toBe(true);
      expect(result.current.state.mealPlans.map(p => p.id)).not.toContain(
        'old',
      );

      await act(async () => {
        await result.current.actions.loadMore();
      });

      await waitFor(() =>
        expect(result.current.state.mealPlans.map(p => p.id)).toContain('old'),
      );
      expect(result.current.state.mealPlans).toHaveLength(21);
      expect(result.current.state.hasMore).toBe(false);
    });

    it('finds the nearest upcoming plan when page one does not hold it', async () => {
      const server = serverMock();
      const { result } = renderHookWithApollo(() => useMealPlans(), {
        operationMocks: [server.mock],
      });

      await waitFor(() =>
        expect(result.current.state.currentPlan?.id).toBe('nearest'),
      );
      expect(result.current.state.mealPlans.map(p => p.id)).not.toContain(
        'nearest',
      );
      expect(server.fired).toContainEqual(
        expect.objectContaining({
          filters: { startDate: TODAY },
          orderBy: { startDate: SortOrder.Asc },
        }),
      );
    });
  });
});
