/**
 * Subscriptions the server refused for a reason retrying cannot fix. A subscribe
 * rejected by document validation is permanent — the socket is fine and its
 * other operations keep delivering, so only a new build reopens the gate.
 */

import { useSyncExternalStore } from 'react';
import type { DocumentNode } from 'graphql';
import { operationNameOf } from '#/apollo/utils/documentOperation';

const rejected = new Set<string>();
const listeners = new Set<() => void>();

const emit = () => {
  listeners.forEach(listener => listener());
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Close the gate on the subscription `document` declares. Returns true the first time, so the caller can
 *  report it once rather than once per reconnect. */
export function markSubscriptionRejected(document: DocumentNode): boolean {
  const name = operationNameOf(document);
  if (rejected.has(name)) return false;
  rejected.add(name);
  emit();
  return true;
}

/** @internal Test seam: the registry read outside React. */
export function isSubscriptionRejected(document: DocumentNode): boolean {
  return rejected.has(operationNameOf(document));
}

/**
 * Test / session-end hook. Not a retry path.
 * @internal Test seam.
 */
export function resetRejectedSubscriptions(): void {
  if (rejected.size === 0) return;
  rejected.clear();
  emit();
}

/** Feeds `useSubscription`'s `skip`, so a rejection stops the resubscribe at
 *  the next render instead of repeating for the life of the session. */
export function useSubscriptionRejected(document: DocumentNode): boolean {
  const name = operationNameOf(document);
  return useSyncExternalStore(
    subscribe,
    () => rejected.has(name),
    () => false,
  );
}
