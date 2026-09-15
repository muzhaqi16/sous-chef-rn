import { waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { GetMealPlansDocument } from '#features/mealPlan/graphql/mealPlan.generated';
import type { MealPlanDisplayFragment } from '#features/mealPlan/graphql/mealPlanFragments.generated';
import { MealPlanType } from '#/graphql/generated/schemaTypes';
import {
  EMPTY_MEAL_PLAN_FILTERS,
  type MealPlanFilterState,
} from '#features/mealPlan/utils/mealPlanFilters';
import { useMealPlanSelectorConfig } from '../useMealPlanSelectorConfig';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');
jest.mock('#hooks/auth/useIsLoggedOut', () => ({
  useIsLoggedOut: () => false,
}));
jest.mock('#hooks/apollo/useApolloErrorLogger', () => ({
  useApolloErrorLogger: jest.fn(),
}));

const displayPlan = (
  id: string,
  planType: MealPlanType,
): MealPlanDisplayFragment => ({
  __typename: 'MealPlan',
  id,
  name: `Plan ${id}`,
  description: null,
  planType,
  startDate: '2025-01-01T00:00:00Z',
  endDate: '2025-01-07T00:00:00Z',
  servings: 2,
  totalCalories: null,
  totalProtein: null,
  totalCarbs: null,
  totalFat: null,
  actualCost: 0,
  budgetAmount: null,
  homeId: null,
  home: null,
  user: { __typename: 'User', id: 'u1' },
  createdBy: null,
  version: 1,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
});

const loadedWeekly = displayPlan('loaded-weekly', MealPlanType.Weekly);
const loadedMonthly = displayPlan('loaded-monthly', MealPlanType.Monthly);

function renderSelector(
  filters: MealPlanFilterState,
  server: ReturnType<typeof recordMock>,
  loadMore = jest.fn(() => Promise.resolve()),
) {
  return renderHookWithApollo(
    () =>
      useMealPlanSelectorConfig({
        plans: {
          mealPlans: [loadedWeekly, loadedMonthly],
          hasMore: true,
          loadingMore: false,
          loadMore,
        },
        filters,
        selectedMealPlanId: null,
        loading: false,
        setSelectedMealPlanId: jest.fn(),
        selectorRef: { current: null },
        toCreateMealPlan: jest.fn(),
        onCreateFromTemplate: jest.fn(),
        onCreateTemplate: jest.fn(),
      }),
    { operationMocks: [server.mock] },
  );
}

const ids = (plans: ReadonlyArray<{ id: string }>) => plans.map(p => p.id);

describe('useMealPlanSelectorConfig', () => {
  it('lists the loaded pages and pages them when no filter is set', () => {
    const server = recordMock(GetMealPlansDocument, {});
    const loadMore = jest.fn(() => Promise.resolve());
    const { result } = renderSelector(
      EMPTY_MEAL_PLAN_FILTERS,
      server,
      loadMore,
    );

    expect(ids(result.current.data)).toEqual([
      'loaded-weekly',
      'loaded-monthly',
    ]);
    expect(result.current.pagination?.hasMore).toBe(true);
    result.current.pagination?.onLoadMore();
    expect(loadMore).toHaveBeenCalled();
    expect(server.fired).toEqual([]);
  });

  it('filters on the server, so a plan outside the loaded pages is listed', async () => {
    const server = recordMock(GetMealPlansDocument, {
      data: {
        mealPlans: {
          __typename: 'MealPlanConnection',
          edges: [
            {
              __typename: 'MealPlanEdge',
              cursor: 'c1',
              node: {
                __typename: 'MealPlan',
                id: 'monthly-page-9',
                planType: MealPlanType.Monthly,
              },
            },
          ],
          pageInfo: {
            __typename: 'PageInfo',
            hasNextPage: false,
            endCursor: null,
          },
        },
      },
    });
    const { result } = renderSelector(
      { ...EMPTY_MEAL_PLAN_FILTERS, planType: MealPlanType.Monthly },
      server,
    );

    // The loaded pages answer until the server does.
    expect(ids(result.current.data)).toEqual(['loaded-monthly']);

    await waitFor(() =>
      expect(ids(result.current.data)).toEqual(['monthly-page-9']),
    );
    expect(server.fired).toContainEqual(
      expect.objectContaining({ filters: { planType: MealPlanType.Monthly } }),
    );
    expect(result.current.pagination?.hasMore).toBe(false);
  });

  it('sends the search once typing settles', async () => {
    const server = recordMock(GetMealPlansDocument, {});
    renderSelector({ ...EMPTY_MEAL_PLAN_FILTERS, search: ' soup ' }, server);

    await waitFor(() =>
      expect(server.fired).toContainEqual(
        expect.objectContaining({ filters: { search: 'soup' } }),
      ),
    );
  });

  it('falls back to filtering the loaded pages when the server cannot answer', async () => {
    const server = recordMock(GetMealPlansDocument, {
      error: new Error('Network request failed'),
    });
    const loadMore = jest.fn(() => Promise.resolve());
    const { result } = renderSelector(
      { ...EMPTY_MEAL_PLAN_FILTERS, planType: MealPlanType.Weekly },
      server,
      loadMore,
    );

    await waitFor(() => expect(server.fired.length).toBeGreaterThan(0));
    expect(ids(result.current.data)).toEqual(['loaded-weekly']);
    result.current.pagination?.onLoadMore();
    expect(loadMore).toHaveBeenCalled();
  });
});
