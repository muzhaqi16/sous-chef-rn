import type { TypePolicies } from '@apollo/client';
import type { FieldFunctionOptions } from '@apollo/client';
import { mergeConnectionByNodeId } from '#/apollo/cacheFieldPolicies';

/**
 * A recipe merges field-wise; `recipes` keys on the whole `filters` input, so each filter set keeps its own entry.
 *
 * Merged into the cache by `makeCache()`, which throws rather than let two
 * features silently overwrite each other on the same field.
 */
export const recipesTypePolicies: TypePolicies = {
  Recipe: {
    merge: true, // Enable automatic field-level merging for partial data
  },
  Query: {
    fields: {
      recipe: {
        read(
          existing: unknown,
          { args, toReference, canRead }: FieldFunctionOptions,
        ) {
          if (existing !== undefined) return existing;
          const ref = toReference({
            __typename: 'Recipe',
            id: args?.id as string,
          });
          return canRead(ref) ? ref : existing;
        },
      },
      recipes: {
        ...mergeConnectionByNodeId(),
        // MyRecipes passes category/difficulty nested inside `filters:` —
        // keying on the whole input object keeps each filter set in its
        // own entry (variable-less cache.updateQuery writers collapse to
        // the same `filters: {}` key on both write and read paths).
        keyArgs: ['filters'],
      },
    },
  },
};
