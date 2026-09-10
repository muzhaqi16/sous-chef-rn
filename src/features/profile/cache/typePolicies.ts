import type { TypePolicies } from '@apollo/client';
import { mergeConnectionByNodeId } from '#/apollo/cacheFieldPolicies';

/**
 * The signed-in user's profile merges field-wise: one query returns the display name, another the real name, and neither may blank the other.
 *
 * Merged into the cache by `makeCache()`, which throws rather than let two
 * features silently overwrite each other on the same field.
 */
export const profileTypePolicies: TypePolicies = {
  User: {
    fields: {
      profile: {
        // Merge profile fields to prevent data loss when partial updates arrive
        // e.g., one query returns {displayName, avatar}, another returns {firstName, lastName}
        merge(existing, incoming, { mergeObjects }) {
          return mergeObjects(existing, incoming);
        },
      },
      savedRecipesConnection: mergeConnectionByNodeId(),
      // Keyed on filters + orderBy so the unread-badge query and the filtered
      // history feed keep separate paginated lists; edges merge by node id
      // so fetchMore appends pages.
      notificationsConnection: mergeConnectionByNodeId(['filters', 'orderBy']),
    },
  },
};
