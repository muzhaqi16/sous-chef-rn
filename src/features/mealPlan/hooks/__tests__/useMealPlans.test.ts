'use no memo';
import { act, waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
  seedCache,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { GetMealPlansDocument } from '#features/mealPlan/graphql/mealPlan.generated';
import { SortOrder } from '#/graphql/generated/schemaTypes';
import { MealPlanDisplayFragmentDoc } from '#features/mealPlan/graphql/mealPlanFragments.generated';
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
        __typename: 'MealPlan' as const,
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
        user: { __typename: 'User' as const, id: `u-${p.id}` },
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

function planData(
  plans: Array<{ id: string; startDate: string; endDate: string }>,
): MockedResponse {
  return recordMock(GetMealPlansDocument, {
    data: {
      mealPlans: {
        __typename: 'MealPlanConnection' as const,
        edges: plans.map(p => ({
          __typename: 'MealPlanEdge' as const,
          cursor: p.id,
          node: {
            __typename: 'MealPlan' as const,
            ...p,
          },
        })),
        totalCount: plans.length,
        pageInfo: {
          __typename: 'PageInfo' as const,
          hasNextPage: false,
          endCursor: null,
        },
      },
    },
  }).mock;
}

function emptyMock(): MockedResponse {
  return recordMock(GetMealPlansDocument, {
    data: { mealPlans: null },
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
    const now = new Date();
    const plan = {
      id: '1',
      startDate: now.toISOString(),
      endDate: now.toISOString(),
    };
    const { result } = renderHookWithApollo(() => useMealPlans(), {
      operationMocks: [planData([plan])],
      cache: seedPlanCache([plan]),
    });
    await waitFor(() => expect(result.current.state.mealPlans).toHaveLength(1));
    expect(result.current.state.mealPlans[0]!.id).toBe('1');
  });

  it('identifies active plan as current', async () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 86400000);
    const tomorrow = new Date(now.getTime() + 86400000);
    const activePlan = {
      id: 'active',
      startDate: yesterday.toISOString(),
      endDate: tomorrow.toISOString(),
    };
    const { result } = renderHookWithApollo(() => useMealPlans(), {
      operationMocks: [planData([activePlan])],
      cache: seedPlanCache([activePlan]),
    });
    await waitFor(() =>
      expect(result.current.state.currentPlan?.id).toBe('active'),
    );
  });

  describe('beyond the first page', () => {
    const DAY = 86400000;
    type Plan = { id: string; startDate: string; endDate: string };
    const planAt = (id: string, startOffsetDays: number): Plan => ({
      id,
      startDate: new Date(Date.now() + startOffsetDays * DAY).toISOString(),
      endDate: new Date(Date.now() + (startOffsetDays + 6) * DAY).toISOString(),
    });
    const connection = (plans: Plan[], endCursor: string | null) => ({
      mealPlans: {
        __typename: 'MealPlanConnection' as const,
        edges: plans.map(p => ({
          __typename: 'MealPlanEdge' as const,
          cursor: p.id,
          node: { __typename: 'MealPlan' as const, ...p },
        })),
        pageInfo: {
          __typename: 'PageInfo' as const,
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
        data: vars => {
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
          filters: { startDate: expect.any(String) },
          orderBy: { startDate: SortOrder.Asc },
        }),
      );
    });
  });
});
