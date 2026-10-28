import type { ApolloClient } from '@apollo/client';
import {
  connectResyncSources,
  type NavigationSubscribe,
  type ScopeOnScreen,
} from '#/apollo/refetchEvents';
import { startPersistedStores } from '#/store/persistedStores';
import { startCountingDaysOfUse } from '#/domain/reviewPrompt';
import { followDeviceLanguage } from './followDeviceLanguage';

export interface CoreStartOptions {
  client: ApolloClient;
  /** The host's navigation changes, which pace the catch-ups. */
  onNavigation?: NavigationSubscribe;
  /** The scope the host shows, so a resync leaves the hidden ones. */
  scopeOnScreen?: ScopeOnScreen;
}

/**
 * Starts the core, once, at the host's module scope after its install: the
 * persisted stores hydrate (already, where a headless entry started them), days
 * of use start counting, an unpicked language follows the device, and the
 * client's resync sources connect.
 */
export function startCore({
  client,
  onNavigation,
  scopeOnScreen,
}: CoreStartOptions): void {
  startPersistedStores();
  startCountingDaysOfUse();
  followDeviceLanguage();
  connectResyncSources(client, { onNavigation, scopeOnScreen });
}
