import type { FieldFunctionOptions, TypePolicies } from '@apollo/client';
import { mergeConnectionByNodeId } from '#/apollo/cacheFieldPolicies';

/**
 * A home's connections merge by node id, so `fetchMore` appends instead of replacing the page.
 *
 * Merged into the cache by `makeCache()`, which throws rather than let two
 * features silently overwrite each other on the same field.
 */
export const homeTypePolicies: TypePolicies = {
  Home: {
    fields: {
      membersConnection: mergeConnectionByNodeId(),
      invitesConnection: mergeConnectionByNodeId(),
      pantriesConnection: mergeConnectionByNodeId(),
      shoppingListsConnection: mergeConnectionByNodeId(),
      mealPlansConnection: mergeConnectionByNodeId(),
      mealTemplatesConnection: mergeConnectionByNodeId(),
    },
  },
  Query: {
    fields: {
      homes: mergeConnectionByNodeId(),
      // Redirect to the cached entity, so a home the device created reads back
      // by id without a request the server cannot answer yet.
      home: {
        read(
          existing: unknown,
          { args, toReference, canRead }: FieldFunctionOptions,
        ) {
          if (existing !== undefined) return existing;
          const ref = toReference({
            __typename: 'Home',
            id: args?.id as string,
          });
          return canRead(ref) ? ref : existing;
        },
      },
    },
  },
};
