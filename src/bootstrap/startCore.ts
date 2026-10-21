import type { ApolloClient } from '@apollo/client';
import {
  connectResyncSources,
  type NavigationSubscribe,
} from '#/apollo/refetchEvents';
import { startPersistedStores } from '#/store/persistedStores';

export interface CoreStartOptions {
  client: ApolloClient;
  /** The host's navigation changes, which pace the language catch-up. */
  onNavigation?: NavigationSubscribe;
}

/**
 * Starts the core, once, at the host's module scope after its install: the
 * persisted stores hydrate (already, where a headless entry started them) and
 * the client's resync sources connect.
 */
export function startCore({ client, onNavigation }: CoreStartOptions): void {
  startPersistedStores();
  connectResyncSources(client, { onNavigation });
}
