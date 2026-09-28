import type { DocumentNode } from 'graphql';
import { useIsHomeSelectionReady } from '#store/useAppStore';
import { useSubscriptionRejected } from '#/services/subscriptions/rejectedSubscriptions';
import { useIsCreateUnconfirmed } from '#hooks/offline/useIsCreateUnconfirmed';

/**
 * `skip` for a subscription keyed on the selected home or pantry. It holds while
 * the id's create is unconfirmed: the server refuses events for a row it has not
 * created and completes the subscription, and nothing reopens it.
 */
export function useEntitySubscriptionSkip(
  document: DocumentNode,
  entityId: string | undefined,
): boolean {
  const isHomeSelectionReady = useIsHomeSelectionReady();
  const rejected = useSubscriptionRejected(document);
  const isUnconfirmed = useIsCreateUnconfirmed(entityId);
  return !entityId || !isHomeSelectionReady || rejected || isUnconfirmed;
}
