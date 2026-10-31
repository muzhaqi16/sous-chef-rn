import { gql } from '@apollo/client';
import { act } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import {
  recordMock,
  renderHookWithApollo,
  seedFragment,
} from '#/test-utils/apolloMockProvider';
import { CreateMealPlanItemDocument } from '#features/mealPlan/graphql/mealPlan.generated';
import { MealType } from '#/graphql/generated/schemaTypes';
import { useMealPlanItemActions } from '../useMealPlanItemActions';

const PLAN_ID = 'plan-1';
const HELD_ID = 'held-meal-1';

// Selected with its paging arguments, as every reader of a loaded plan does.
const PLAN_MEALS = gql`
  fragment TestConvergedPlanMeals on MealPlan {
    id
    mealPlanItemsConnection(first: $mealsFirst, after: $mealsAfter) {
      edges {
        node {
          id
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

type PlanMeals = {
  mealPlanItemsConnection: { edges: Array<{ node: { id: string } }> };
};

/**
 * A recipe meal is unique on (plan, date, meal type, recipe): adding one the
 * plan already holds answers with the held row, under its own id.
 */
describe('adding a recipe meal the plan already holds', () => {
  it('withdraws the minted meal and shows only the held one', async () => {
    const cache = makeCache();
    const planCacheId = cache.identify({ __typename: 'MealPlan', id: PLAN_ID });
    seedFragment(cache, {
      id: planCacheId,
      fragment: PLAN_MEALS,
      data: {
        __typename: 'MealPlan',
        id: PLAN_ID,
        mealPlanItemsConnection: {
          __typename: 'MealPlanItemConnection',
          edges: [
            {
              __typename: 'MealPlanItemEdge',
              node: { __typename: 'MealPlanItem', id: HELD_ID },
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
    const plan = cache.readFragment<PlanMeals>({
      id: planCacheId,
      fragment: PLAN_MEALS,
    });
    // One edge for the held meal: not a second one, and none for the minted.
    expect(
      plan?.mealPlanItemsConnection.edges.map(({ node }) => node.id),
    ).toEqual([HELD_ID]);
    expect(cache.extract()[`MealPlanItem:${mintedId}`]).toBeUndefined();
  });
});
