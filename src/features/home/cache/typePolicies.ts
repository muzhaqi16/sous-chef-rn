import type { TypePolicies } from '@apollo/client';
import {
  mergeConnectionByNodeId,
  readByIdFromCache,
} from '#/apollo/cacheFieldPolicies';

/**
 * A home's connections merge by node id, so `fetchMore` appends. `makeCache()`
 * throws rather than let two features overwrite each other on one field.
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
