import type { TypePolicies } from '@apollo/client';
import {
  mergeConnectionByNodeId,
  readByIdFromCache,
} from '#/apollo/cacheFieldPolicies';

/**
 * A recipe merges field-wise; `recipes` keys on the whole `filters` input, so each filter set keeps its own entry.
 * A recipe's ingredients are ONE list whatever arguments read it: a selection
 * that names a page size and a local writer that names none hold the same rows.
 *
 * Merged into the cache by `makeCache()`, which throws rather than let two
 * features silently overwrite each other on the same field.
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
