import type { ApolloClient } from '@apollo/client';

/** The context key naming the screen a query belongs to. */
export const RESYNC_SCOPE = 'resyncScope';

const byClient = new WeakMap<ApolloClient, Map<string, ApolloClient>>();

/**
 * The client for a subtree kept mounted while hidden (a home tab): each query
 * watched through it carries `scope` in its context, so a resync re-asks it
 * only while that scope is shown. Everything else is the client itself, one
 * per scope.
 */
export function scopedClient(
  client: ApolloClient,
  scope: string,
): ApolloClient {
  const scopes = byClient.get(client) ?? new Map<string, ApolloClient>();
  byClient.set(client, scopes);
  const known = scopes.get(scope);
  if (known) return known;

  // Every hook that watches a query calls this; the client binds its own
  // `watchQuery` at construction, so it is replaced here rather than defaulted.
  const watchQuery = (options: Parameters<ApolloClient['watchQuery']>[0]) =>
    client.watchQuery({
      ...options,
      context: { ...options.context, [RESYNC_SCOPE]: scope },
    });
  const scoped = new Proxy(client, {
    get: (target, key, receiver): unknown =>
      key === 'watchQuery' ? watchQuery : Reflect.get(target, key, receiver),
  });
  scopes.set(scope, scoped);
  return scoped;
}
