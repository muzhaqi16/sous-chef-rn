import type { ApolloClient } from '@apollo/client';
import {
  connectResyncSources,
  type NavigationSubscribe,
  type ScopeOnScreen,
} from '#/apollo/refetchEvents';
import { startPersistedStores } from '#/store/persistedStores';

export interface CoreStartOptions {
  client: ApolloClient;
  /** The host's navigation changes, which pace the catch-ups. */
  onNavigation?: NavigationSubscribe;
  /** The scope the host shows, so a resync leaves the hidden ones. */
  scopeOnScreen?: ScopeOnScreen;
}

/**
 * Starts the core, once, at the host's module scope after its install: the
 * persisted stores hydrate (already, where a headless entry started them) and
 * the client's resync sources connect.
 */
export function startCore({
  client,
  onNavigation,
  scopeOnScreen,
}: CoreStartOptions): void {
  startPersistedStores();
  connectResyncSources(client, { onNavigation, scopeOnScreen });
}
