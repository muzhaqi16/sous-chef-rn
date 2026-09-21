import { Environment, logger } from '#/utils/environment';

/** Abort a probe that hangs — a hung request IS the failure mode being probed. */
const PROBE_TIMEOUT_MS = 5_000;

/**
 * A REST endpoint beside the GraphQL one
 * (`https://api.example.com/graphql` + `/health` → `https://api.example.com/health`).
 */
export const getApiRestUrl = (path: `/${string}`): string => {
  const { baseUrl } = Environment.getApiConfig();
  return `${baseUrl.replace(/\/graphql\/?$/, '')}${path}`;
};

/** Exported for tests. */
export const getHealthUrl = (): string => getApiRestUrl('/health');

/**
 * A plain GET of `/health` — no GraphQL, no auth, no link chain. Lets
 * `apiReachabilityBreaker` re-check an open circuit rather than wait for
 * traffic `offlineModeLink` is blocking. Only 2xx counts as reachable; a 5xx
 * keeps the app serving cache.
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
