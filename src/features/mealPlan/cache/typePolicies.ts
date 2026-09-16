import type { TypePolicies } from '@apollo/client';
import {
  mergeConnectionByNodeId,
  mergeArrayByIdIntelligent,
} from '#/apollo/cacheFieldPolicies';

type MergeableItems = Parameters<typeof mergeArrayByIdIntelligent>[0];

/**
 * A plan's items merge by entity id rather than being replaced, so a partial write cannot drop the rest of the day.
 *
 * Merged into the cache by `makeCache()`, which throws rather than let two
 * features silently overwrite each other on the same field.
 */
export const mealPlanTypePolicies: TypePolicies = {
  MealPlan: {
    merge: true,
    fields: {
      mealPlanItems: {
        merge(
          existing: MergeableItems,
          incoming: MergeableItems,
          { readField },
        ) {
          return mergeArrayByIdIntelligent(existing, incoming, {
            readField,
          });
        },
      },
    },
  },
  MealPlanItem: {
    merge: true,
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
