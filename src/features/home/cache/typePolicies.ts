import type { TypePolicies } from '@apollo/client';
import {
  mergeConnectionByNodeId,
  readByIdFromCache,
} from '#/apollo/cacheFieldPolicies';

/**
 * A home's connections merge by node id, so `fetchMore` appends instead of replacing the page.
 *
 * Merged into the cache by `makeCache()`, which throws rather than let two
 * features silently overwrite each other on the same field.
 */
export const homeTypePolicies: TypePolicies = {
  Home: {
    fields: {
      membersConnection: mergeConnectionByNodeId(['orderBy']),
      invitesConnection: mergeConnectionByNodeId(),
      pantriesConnection: mergeConnectionByNodeId(['orderBy']),
      shoppingListsConnection: mergeConnectionByNodeId(),
      mealTemplatesConnection: mergeConnectionByNodeId(),
    },
  },
  Query: {
    fields: {
      homes: mergeConnectionByNodeId(),
      home: readByIdFromCache('Home'),
    },
  },
};
