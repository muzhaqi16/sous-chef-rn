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
    optimistic: true,
  })?.version ?? undefined;

/**
 * Sends once every earlier write through here settles, at the `version` the
 * cache then holds: two writes in one round trip must not both send N. Only the
 * send waits, and a queued write settles at once, as the queue rebases its own.
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

/** An edit of a row whose version the cache does not hold. */
export class UnreadVersionError extends Error {
  constructor(typename: string) {
    super(`${typename}: no cached version to state on this edit`);
    this.name = 'UnreadVersionError';
  }
}

/**
 * {@link chainEntityWrite} for an input whose `version` is REQUIRED. The API
 * refuses an edit that states none, so a row the cache holds no version of is
 * not sent: the write rejects, and `settleMutation` reports it as failed.
 */
export function chainVersionedWrite<T>(
  cache: ApolloCache,
  entity: FieldsEntityRef,
  send: (version: number) => Promise<T>,
): Promise<T> {
  return chainEntityWrite(cache, entity, version =>
    version === undefined
      ? Promise.reject(new UnreadVersionError(entity.__typename))
      : send(version),
  );
}
