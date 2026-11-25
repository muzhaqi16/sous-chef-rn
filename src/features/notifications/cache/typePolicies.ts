import type { TypePolicies } from '@apollo/client';
import { readByIdFromCache } from '#apollo/cacheFieldPolicies';

/**
 * A notification held from the feed answers its detail read from the cache;
 * one the device does not hold yet, such as a push opened from a closed app,
 * goes to the server.
 */
export const notificationsTypePolicies: TypePolicies = {
  Query: {
    fields: {
      notification: readByIdFromCache('Notification'),
    },
  },
};
