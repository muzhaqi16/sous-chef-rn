import { Environment, logger } from '#/utils/environment';

/** Abort a probe that hangs — a hung request IS the failure mode being probed. */
const PROBE_TIMEOUT_MS = 5_000;

/**
 * REST health endpoint derived from the GraphQL base URL
 * (`https://api.example.com/graphql` → `https://api.example.com/health`).
 * Exported for tests.
 */
export const getHealthUrl = (): string => {
  const { baseUrl } = Environment.getApiConfig();
  return `${baseUrl.replace(/\/graphql\/?$/, '')}/health`;
};

/**
 * One cheap reachability probe: a plain GET of the API's `/health` endpoint —
 * no GraphQL parsing, no auth, no Apollo link chain. Used by
 * `apiReachabilityBreaker` to actively re-check an open circuit instead of
 * waiting for user traffic (which `offlineModeLink` is blocking precisely
 * because the circuit is open).
 *
 * `true` means the API answered 2xx — transport is up and the server is
 * healthy enough to take traffic. Any network error, timeout, or non-2xx
 * counts as unreachable (conservative: a 5xx keeps the app serving cache).
 */
export async function probeApiHealth(): Promise<boolean> {
  const url = getHealthUrl();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      // A 404 here means the endpoint is missing in this environment — the
      // probe can then never close the circuit, so make it unmissable.
      logger.warn(`Health probe got HTTP ${response.status} from ${url}`);
    }
    return response.ok;
  } catch (error) {
    logger.debug(`Health probe failed (${url}):`, error);
    return false;
  } finally {
    clearTimeout(timer);
  }
}
