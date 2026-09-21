import { env } from '#/config/env';
import { getApiRestUrl } from '#/apollo/links/apiHealthProbe';
import { useStore } from '#store';
import { isNetworkWithheld } from '#store/slices/networkSlice';
import { registerSessionTeardown } from '#store/sessionTeardown';
import {
  addPendingRevocation,
  loadPendingRevocations,
  removePendingRevocation,
  type PendingRevocation,
} from '#/storage/keychain';
import { logger } from '#/utils/environment';

// Push delivery follows a LIVE session bound to this device, so a session the
// client drops without `POST /revoke` keeps receiving the account's pushes until
// its refresh token expires. Every session end parks its token first (durable
// before the network), then drains; offline it waits for the API to come back.

const REVOKE_TIMEOUT_MS = 5_000;

/** `retry`: nothing settled — the network, a 5xx or a rate limit. */
type RevokeOutcome = 'revoked' | 'rejected' | 'retry';

async function postRevoke(
  revocation: PendingRevocation,
): Promise<RevokeOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REVOKE_TIMEOUT_MS);
  try {
    const response = await fetch(getApiRestUrl('/revoke'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(env.API_KEY && { 'x-api-key': env.API_KEY }),
        // Denylists the access token too; the server ignores an expired one.
        ...(revocation.accessToken && {
          Authorization: `Bearer ${revocation.accessToken}`,
        }),
      },
      body: JSON.stringify({ refreshToken: revocation.refreshToken }),
      signal: controller.signal,
    });
    if (response.ok) return 'revoked';
    if (response.status === 429 || response.status >= 500) return 'retry';
    // A 4xx no later attempt can change; the token is unknown or malformed.
    logger.warn(`Refresh-token revoke refused with HTTP ${response.status}`);
    return 'rejected';
  } catch (error) {
    logger.debug('Refresh-token revoke did not reach the API:', error);
    return 'retry';
  } finally {
    clearTimeout(timer);
  }
}

let drainInFlight: Promise<void> | null = null;

async function drainOnce(): Promise<void> {
  const pending = await loadPendingRevocations();
  for (const revocation of pending) {
    if (isNetworkWithheld(useStore.getState())) return;
    const outcome = await postRevoke(revocation);
    // The API is not answering; the next reconnect retries the rest.
    if (outcome === 'retry') return;
    await removePendingRevocation(revocation.refreshToken);
  }
}

/** Revoke every parked token. Single-flight; a no-op while offline. */
export function drainPendingRevocations(): Promise<void> {
  if (isNetworkWithheld(useStore.getState())) return Promise.resolve();
  drainInFlight ??= drainOnce()
    .catch(error => logger.warn('Pending revocation drain failed:', error))
    .finally(() => {
      drainInFlight = null;
    });
  return drainInFlight;
}

async function revokeEndedSession(
  revocation: PendingRevocation,
): Promise<void> {
  const parked = await addPendingRevocation(revocation);
  if (!parked) {
    // Nothing durable holds it, so this attempt is the only one.
    const outcome = await postRevoke(revocation);
    if (outcome !== 'revoked') {
      logger.warn('Ended session may stay live server-side until it expires');
    }
    return;
  }
  // A drain already running read the list before this park; chain another.
  await drainInFlight;
  await drainPendingRevocations();
}

// Every session end, the server-ended ones included: `/revoke` is idempotent,
// and a session ended locally on an access-token refusal still has a live
// lineage. Reads the tokens before any await — `resetStore` clears them next.
// Never awaited: a sign-out does not wait on the network.
registerSessionTeardown('refresh-token-revoke', () => {
  const { refreshToken, accessToken } = useStore.getState();
  if (!refreshToken) return;
  void revokeEndedSession({ refreshToken, accessToken }).catch(error =>
    logger.warn('Refresh-token revoke failed:', error),
  );
});
