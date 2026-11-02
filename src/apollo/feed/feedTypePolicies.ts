import type { TypePolicies } from '@apollo/client';

/**
 * A page is read once and evicted once applied, so these never become rows of
 * their own, and a replacing merge leaves one answer pinning what it names.
 */
export const feedTypePolicies: TypePolicies = {
  Query: {
    fields: {
      syncChanges: { keyArgs: false, merge: false },
      syncSnapshot: { keyArgs: false, merge: false },
    },
  },
  SyncScope: { keyFields: false },
  SyncRemoval: { keyFields: false },
};
