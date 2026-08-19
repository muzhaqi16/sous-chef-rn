/**
 * Subscriptions the server refused for a reason retrying cannot fix.
 *
 * A subscribe rejected by document validation is permanent: the same document
 * is refused every time, and the connection is fine — the socket stays open and
 * its other operations keep delivering. Re-sending it on every reconnect is
 * pure waste. Nothing reopens the gate: only a new build can change the
 * document.
 */

import { useSyncExternalStore } from 'react';

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

/** Close the gate on `name`. Returns true the first time, so the caller can
 *  report it once rather than once per reconnect. */
export function markSubscriptionRejected(name: string): boolean {
  if (rejected.has(name)) return false;
  rejected.add(name);
  emit();
  return true;
}

export function isSubscriptionRejected(name: string): boolean {
  return rejected.has(name);
}

/** Test / session-end hook. Not a retry path. */
export function resetRejectedSubscriptions(): void {
  if (rejected.size === 0) return;
  rejected.clear();
  emit();
}

/** Feeds `useSubscription`'s `skip`, so a rejection stops the resubscribe at
 *  the next render instead of repeating for the life of the session. */
export function useSubscriptionRejected(name: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => rejected.has(name),
    () => false,
  );
}
