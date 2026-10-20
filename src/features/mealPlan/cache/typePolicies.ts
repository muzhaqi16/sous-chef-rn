import type { TypePolicies } from '@apollo/client';
import { mergeConnectionByNodeId } from '#/apollo/cacheFieldPolicies';

/**
 * A plan's meals, its generated lists and a template's meals are each ONE list
 * per parent whatever page was asked for, merged by node id: a second page
 * appends, and every local writer sees the whole list.
 */
export const mealPlanTypePolicies: TypePolicies = {
  MealPlan: {
    merge: true,
    fields: {
      mealPlanItemsConnection: mergeConnectionByNodeId(false),
      generatedShoppingListsConnection: mergeConnectionByNodeId(false),
    },
  },
  MealPlanItem: {
    merge: true,
  },
  MealTemplate: {
    fields: {
      itemsConnection: mergeConnectionByNodeId(false),
    },
  },
  Query: {
    fields: {
      mealPlans: {
        ...mergeConnectionByNodeId(),
        keyArgs: ['filters'],
      },
      mealTemplates: {
        ...mergeConnectionByNodeId(),
        keyArgs: ['filters'],
      },
    },
  },
};
