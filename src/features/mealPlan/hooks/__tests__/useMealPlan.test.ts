import { act, waitFor } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { GetMealPlanDocument } from '#features/mealPlan/graphql/mealPlan.generated';
import {
  MealPlanMain_ItemFragmentDoc,
  MealPlanMain_MealPlanFragmentDoc,
} from '#features/mealPlan/screens/MealPlanMain.generated';
import { unconfirmedCreates } from '#/apollo/offline/unconfirmedCreates';
import { useMealPlan } from '../useMealPlan';

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

    await waitFor(() => expect(get.fired).toContainEqual({ id: 'plan-1' }));
  });

  it('queries immediately for a plan the server already knows', async () => {
    const get = recordMock(GetMealPlanDocument, {
      error: new Error('network unavailable'),
    });

    renderHookWithApollo(() => useMealPlan('plan-2'), {
      operationMocks: [get.mock],
    });

    await waitFor(() => expect(get.fired).toContainEqual({ id: 'plan-2' }));
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
            mealPlanItems: [
              {
                __typename: 'MealPlanItem',
                id: 'item-1',
                servings: 2,
                customMealName: 'Soup',
                recipe: null,
              },
            ],
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
      return { cache, ...rendered };
    };

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
});
