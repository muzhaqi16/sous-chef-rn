/**
 * Read-back for thin subscription events.
 *
 * Subscription documents are validated against depth 5 / cost 500, so the
 * events carry an envelope and an id and the values come from here — an
 * ordinary query, over HTTP, fired only where one is needed. `client.query`
 * normalizes the result, leaving the handler only connection membership.
 */

import type { TypedDocumentNode } from '@apollo/client';
import { logger } from '#/utils/environment';
import type { SubscriptionApolloClient } from './types';

/**
 * Fetch one entity named by an event and write it into the cache.
 *
 * Returns `null` when the read produced no data — offline, a transport failure,
 * or the entity deleted between the event and this call. All three mean the
 * same to a caller: nothing to add to a connection, and not a failure. The list
 * self-corrects on its next `cache-and-network` read.
 */
export async function fetchEventEntity<TData, TVariables extends object>(
  client: SubscriptionApolloClient,
  query: TypedDocumentNode<TData, TVariables>,
  variables: TVariables,
  label: string,
): Promise<TData | null> {
  let result;
  try {
    result = await client.query({
      query,
      variables,
      fetchPolicy: 'network-only',
      errorPolicy: 'all',
    });
  } catch (error) {
    // Offline, or the socket outlived the network.
    if (__DEV__) {
      logger.debug(
        `📡 [Subscription] ${label} read-back unavailable`,
        error instanceof Error ? error.message : String(error),
      );
    }
    return null;
  }

  const data = result?.data ?? null;
  if (!data && __DEV__) {
    logger.debug(`📡 [Subscription] ${label} read-back returned no entity`);
  }
  return data;
}
