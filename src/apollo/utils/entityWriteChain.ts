import type { ApolloCache } from '@apollo/client';
import { localFirstFragment, type FieldsEntityRef } from './localFirstFields';

// Per cache, so a client torn down with a write in flight holds up no other.
const tails = new WeakMap<ApolloCache, Map<string, Promise<void>>>();

const noop = () => {};

const cachedVersion = (
  cache: ApolloCache,
  id: string,
  typename: string,
): number | undefined =>
  cache.readFragment<{ version?: number | null }>({
    id,
    fragment: localFirstFragment(typename, 'version'),
  })?.version ?? undefined;

/**
 * Sends a write to `entity` once every earlier one sent through here has
 * settled, with the `version` the cache holds at that moment. An earlier
 * write's answer carries the version it moved the row to, so two writes inside
 * one round trip do not both send N and refuse the user's own second edit as
 * changed elsewhere. The caller's local write stays immediate; only the send
 * waits. A queued write settles at once: the queue rebases its own.
 */
export function chainEntityWrite<T>(
  cache: ApolloCache,
  entity: FieldsEntityRef,
  send: (version: number | undefined) => Promise<T>,
): Promise<T> {
  const id = cache.identify(entity);
  if (!id) return send(undefined);
  const chains = tails.get(cache) ?? new Map<string, Promise<void>>();
  tails.set(cache, chains);

  const run = () => send(cachedVersion(cache, id, entity.__typename));
  const previous = chains.get(id);
  const sent = previous ? previous.then(run) : run();
  const tail = sent.then(noop, noop);
  chains.set(id, tail);
  void tail.then(() => {
    if (chains.get(id) === tail) chains.delete(id);
  });
  return sent;
}
