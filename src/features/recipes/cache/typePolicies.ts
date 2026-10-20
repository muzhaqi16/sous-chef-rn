import type { TypePolicies } from '@apollo/client';
import {
  mergeConnectionByNodeId,
  readByIdFromCache,
} from '#/apollo/cacheFieldPolicies';

/**
 * A recipe merges field-wise; `recipes` keys on the whole `filters` input.
 * Ingredients are ONE list whatever arguments read them: a paged selection and
 * a local writer naming none hold the same rows.
 */
export const recipesTypePolicies: TypePolicies = {
  Recipe: {
    merge: true, // Enable automatic field-level merging for partial data
    fields: {
      ingredientsConnection: mergeConnectionByNodeId(false),
    },
  },
  Query: {
    fields: {
      recipe: readByIdFromCache('Recipe'),
      recipes: {
        ...mergeConnectionByNodeId(),
        keyArgs: ['filters'],
      },
      // A ranking for one day: a new answer replaces the last, never merges.
      recipeSuggestions: {
        keyArgs: ['today'],
        merge: (_existing: unknown, incoming: unknown) => incoming,
      },
    },
  },
};
