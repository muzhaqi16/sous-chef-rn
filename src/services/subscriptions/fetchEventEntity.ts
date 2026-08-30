/**
 * Read-back for thin subscription events. Subscription documents are validated
 * against depth 5 / cost 500, so events carry only an envelope and an id and the
 * values come from an ordinary HTTP query here.
 */

import type { OperationVariables, TypedDocumentNode } from '@apollo/client';
import { logger } from '#/utils/environment';
import type { SubscriptionApolloClient } from './types';

/**
 * `null` covers offline, transport failure and an entity deleted since the event
 * — all mean "nothing to add", not a failure; the list self-corrects on its next
 * `cache-and-network` read.
 */
export async function fetchEventEntity<
  TData,
  TVariables extends OperationVariables,
>(
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
