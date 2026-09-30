import { gql } from '@apollo/client';
import { act } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { CreateMealPlanItemDocument } from '#features/mealPlan/graphql/mealPlan.generated';
import { MealType } from '#/graphql/generated/schemaTypes';
import { useMealPlanItemActions } from '../useMealPlanItemActions';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/services/toastService', () => ({
  toastService: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
  },
}));

const PLAN_ID = 'plan-1';
const HELD_ID = 'held-meal-1';

const PLAN_MEALS = gql`
  fragment TestConvergedPlanMeals on MealPlan {
    id
    mealPlanItems {
      id
    }
  }
`;

/**
 * A recipe meal is unique on (plan, date, meal type, recipe): adding one the
 * plan already holds answers with the held row, under its own id.
 */
describe('adding a recipe meal the plan already holds', () => {
  it('withdraws the minted meal and shows only the held one', async () => {
    const cache = makeCache();
    const planCacheId = cache.identify({ __typename: 'MealPlan', id: PLAN_ID });
    cache.writeFragment({
      id: planCacheId,
      fragment: PLAN_MEALS,
      data: {
        __typename: 'MealPlan',
        id: PLAN_ID,
        mealPlanItems: [{ __typename: 'MealPlanItem', id: HELD_ID }],
      },
    });
    const create = recordMock(CreateMealPlanItemDocument, {
      data: {
        createMealPlanItem: {
          __typename: 'CreateMealPlanItemPayload',
          mealPlanItem: { __typename: 'MealPlanItem', id: HELD_ID },
        },
      },
    });
    const { result } = renderHookWithApollo(
      () => useMealPlanItemActions(PLAN_ID),
      { operationMocks: [create.mock], cache },
    );

    await act(async () => {
      await result.current.createItem({
        mealPlanId: PLAN_ID,
        meal: { recipeId: 'recipe-1' },
        mealType: MealType.Dinner,
        date: '2026-09-29',
      });
    });

    const [sent] = create.fired;
    const mintedId = (sent?.input as { id: string } | undefined)?.id;
    expect(mintedId).toBeDefined();
    expect(mintedId).not.toBe(HELD_ID);
    const plan = cache.readFragment<{ mealPlanItems: Array<{ id: string }> }>({
      id: planCacheId,
      fragment: PLAN_MEALS,
    });
    expect(plan?.mealPlanItems.map(({ id }) => id)).toEqual([HELD_ID]);
    expect(cache.extract()[`MealPlanItem:${mintedId}`]).toBeUndefined();
  });
});
