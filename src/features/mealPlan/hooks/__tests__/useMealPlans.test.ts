'use no memo';
import { waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
  seedCache,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { GetMealPlansDocument } from '#features/mealPlan/graphql/mealPlan.generated';
import type { PaginationConfig } from '#hooks/utils/usePagination';
import { useMealPlans } from '../useMealPlans';

function seedPlanCache(
  plans: Array<{ id: string; startDate: string; endDate: string }>,
) {
  return seedCache(
    plans.map(p => ({
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

jest.mock('#/utils/compilerSafeWrappers', () => ({
  executeMutation: jest.fn(<T>(fn: () => Promise<T>) => fn()),
}));

jest.mock('#hooks/utils/usePagination', () => ({
  usePagination: jest.fn((config: PaginationConfig) => ({
    hasMore: config.pageInfo?.hasNextPage ?? false,
    endCursor: config.pageInfo?.endCursor ?? null,
    loadMore: jest.fn(),
    isLoadingMore: false,
    loadMoreError: false,
  })),
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
    expect(result.current.state.totalCount).toBeUndefined();
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
    expect(result.current.state.mealPlans[0].id).toBe('1');
    expect(result.current.state.totalCount).toBe(1);
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
});
