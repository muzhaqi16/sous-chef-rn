import { act, waitFor } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import {
  recordMock,
  renderHookWithApollo,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { GetMealPlanDocument } from '#features/mealPlan/graphql/mealPlan.generated';
import {
  MealPlanMain_ItemFragmentDoc,
  MealPlanMain_MealPlanFragmentDoc,
} from '#features/mealPlan/screens/MealPlanMain.generated';
import { unconfirmedCreates } from '#/apollo/offline/unconfirmedCreates';
import { MEALS_PAGE_SIZE } from '#features/mealPlan/utils/mealPlanPaging';
import { RECIPE_INGREDIENTS_PAGE_SIZE } from '#domain/recipeIngredientsPaging';
import { useMealPlan } from '../useMealPlan';

/** The page sizes a read of a plan states: its meals, each recipe's ingredients. */
const PLAN_PAGES = {
  mealsFirst: MEALS_PAGE_SIZE,
  ingredientsFirst: RECIPE_INGREDIENTS_PAGE_SIZE,
};

jest.mock('#/apollo/links/tokenScheduler');

describe('useMealPlan', () => {
  it('skips the detail query until the local-first create is acknowledged', async () => {
    // The row does not exist server-side yet, so this read could only come back
    // RESOURCE_NOT_FOUND.
    unconfirmedCreates.mark('plan-1');
    const get = recordMock(GetMealPlanDocument, {
      error: new Error('should not fire while unconfirmed'),
    });

    const { result } = renderHookWithApollo(() => useMealPlan('plan-1'), {
      operationMocks: [get.mock],
    });

    expect(get.fired).toHaveLength(0);
    expect(result.current.loading).toBe(false);

    // Acknowledgement is the fetch trigger: the server now has data to give.
    act(() => {
      unconfirmedCreates.confirm('plan-1');
    });

    await waitFor(() =>
      expect(get.fired).toContainEqual({ id: 'plan-1', ...PLAN_PAGES }),
    );
  });

  it('queries immediately for a plan the server already knows', async () => {
    const get = recordMock(GetMealPlanDocument, {
      error: new Error('network unavailable'),
    });

    renderHookWithApollo(() => useMealPlan('plan-2'), {
      operationMocks: [get.mock],
    });

    // The server's largest page: a plan of up to a hundred meals is one
    // request, and so are a hundred ingredients of each recipe in it.
    await waitFor(() =>
      expect(get.fired).toContainEqual({
        id: 'plan-2',
        mealsFirst: 100,
        ingredientsFirst: 100,
      }),
    );
  });

  it('skips entirely when there is no active plan', () => {
    const get = recordMock(GetMealPlanDocument, {
      error: new Error('should not fire without an id'),
    });

    const { result } = renderHookWithApollo(() => useMealPlan(null), {
      operationMocks: [get.mock],
    });

    expect(get.fired).toHaveLength(0);
    expect(result.current.mealPlan).toBeNull();
    expect(result.current.items).toEqual([]);
  });
  describe('a loaded plan', () => {
    const loadPlan = async () => {
      const cache = makeCache();
      const get = recordMock(GetMealPlanDocument, {
        data: {
          mealPlan: {
            __typename: 'MealPlan',
            id: 'plan-3',
            name: 'Week one',
            mealPlanItemsConnection: {
              edges: [
                {
                  node: {
                    __typename: 'MealPlanItem',
                    id: 'item-1',
                    servings: 2,
                    customMealName: 'Soup',
                    recipe: null,
                  },
                },
              ],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        },
      });
      const rendered = renderHookWithApollo(() => useMealPlan('plan-3'), {
        operationMocks: [get.mock],
        cache,
      });
      await waitFor(() =>
        expect(rendered.result.current.itemDetails).toHaveLength(1),
      );
      return { cache, get, ...rendered };
    };

    it('reads a plan that fits one page whole, with one request', async () => {
      const { get, result } = await loadPlan();

      expect(result.current.items.map(item => item.id)).toEqual(['item-1']);
      expect(result.current.mealsIncomplete).toBe(false);
      expect(get.fired).toEqual([{ id: 'plan-3', ...PLAN_PAGES }]);
    });

    it("follows an item's own edit, which leaves the query result as it was", async () => {
      const { cache, result } = await loadPlan();
      expect(result.current.itemDetails[0]?.servings).toBe(2);

      await act(async () => {
        cache.writeFragment({
          fragment: MealPlanMain_ItemFragmentDoc,
          fragmentName: 'MealPlanMain_item',
          data: {
            __typename: 'MealPlanItem',
            id: 'item-1',
            servings: 4,
            customMealName: 'Soup',
            recipe: null,
          },
        });
        await Promise.resolve();
      });

      await waitFor(() =>
        expect(result.current.itemDetails[0]?.servings).toBe(4),
      );
    });

    it("follows the plan's own fields", async () => {
      const { cache, result } = await loadPlan();
      expect(result.current.mealPlan?.name).toBe('Week one');

      await act(async () => {
        cache.updateFragment(
          {
            fragment: MealPlanMain_MealPlanFragmentDoc,
            fragmentName: 'MealPlanMain_mealPlan',
            id: cache.identify({ __typename: 'MealPlan', id: 'plan-3' }),
          },
          plan => (plan ? { ...plan, name: 'Week two' } : plan),
        );
        await Promise.resolve();
      });

      await waitFor(() =>
        expect(result.current.mealPlan?.name).toBe('Week two'),
      );
    });
  });
  describe('a plan longer than one page', () => {
    const page = (
      ids: string[],
      pageInfo: { hasNextPage: boolean; endCursor: string | null },
    ): MockDataFor<typeof GetMealPlanDocument> => ({
      mealPlan: {
        __typename: 'MealPlan',
        id: 'plan-4',
        name: 'A long month',
        mealPlanItemsConnection: {
          edges: ids.map(id => ({
            node: {
              __typename: 'MealPlanItem',
              id,
              servings: 1,
              customMealName: `Meal ${id}`,
              recipe: null,
            },
          })),
          pageInfo,
        },
      },
    });

    it('follows the cursor and returns every meal as one list', async () => {
      const first = recordMock(GetMealPlanDocument, {
        match: vars => vars.mealsAfter == null,
        data: page(['item-1', 'item-2'], {
          hasNextPage: true,
          endCursor: 'cursor-2',
        }),
      });
      const second = recordMock(GetMealPlanDocument, {
        match: vars => vars.mealsAfter === 'cursor-2',
        data: page(['item-3'], { hasNextPage: false, endCursor: 'cursor-3' }),
      });

      const { result } = renderHookWithApollo(() => useMealPlan('plan-4'), {
        operationMocks: [first.mock, second.mock],
        cache: makeCache(),
      });

      await waitFor(() =>
        expect(result.current.items.map(item => item.id)).toEqual([
          'item-1',
          'item-2',
          'item-3',
        ]),
      );
      expect(second.fired).toEqual([
        { id: 'plan-4', ...PLAN_PAGES, mealsAfter: 'cursor-2' },
      ]);
      expect(result.current.itemDetails).toHaveLength(3);
      await waitFor(() => expect(result.current.mealsIncomplete).toBe(false));
    });

    it('reports the plan partial when a later page cannot be read', async () => {
      const first = recordMock(GetMealPlanDocument, {
        match: vars => vars.mealsAfter == null,
        data: page(['item-1', 'item-2'], {
          hasNextPage: true,
          endCursor: 'cursor-2',
        }),
      });
      const second = recordMock(GetMealPlanDocument, {
        match: vars => vars.mealsAfter === 'cursor-2',
        error: new Error('network unavailable'),
      });

      const { result } = renderHookWithApollo(() => useMealPlan('plan-4'), {
        operationMocks: [first.mock, second.mock],
        cache: makeCache(),
      });

      await waitFor(() => expect(result.current.mealsIncomplete).toBe(true));
      // The page it did read stays on screen.
      expect(result.current.items.map(item => item.id)).toEqual([
        'item-1',
        'item-2',
      ]);
      expect(second.fired.length).toBeGreaterThan(0);
    });

    it('reads the rest again on a retry, and the plan is whole once it lands', async () => {
      const first = recordMock(GetMealPlanDocument, {
        match: vars => vars.mealsAfter == null,
        data: page(['item-1', 'item-2'], {
          hasNextPage: true,
          endCursor: 'cursor-2',
        }),
      });
      const failing = recordMock(GetMealPlanDocument, {
        match: vars => vars.mealsAfter === 'cursor-2',
        error: new Error('network unavailable'),
        maxUsageCount: 1,
      });
      const landing = recordMock(GetMealPlanDocument, {
        match: vars => vars.mealsAfter === 'cursor-2',
        data: page(['item-3'], { hasNextPage: false, endCursor: 'cursor-3' }),
      });

      const { result } = renderHookWithApollo(() => useMealPlan('plan-4'), {
        operationMocks: [first.mock, failing.mock, landing.mock],
        cache: makeCache(),
      });
      await waitFor(() => expect(result.current.mealsIncomplete).toBe(true));
      expect(landing.fired).toHaveLength(0);

      act(() => {
        result.current.retryRemainingMeals();
      });

      await waitFor(() =>
        expect(result.current.items.map(item => item.id)).toEqual([
          'item-1',
          'item-2',
          'item-3',
        ]),
      );
      await waitFor(() => expect(result.current.mealsIncomplete).toBe(false));
      expect(landing.fired).toEqual([
        { id: 'plan-4', ...PLAN_PAGES, mealsAfter: 'cursor-2' },
      ]);
    });
  });
});
