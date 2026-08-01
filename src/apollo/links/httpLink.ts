import { ApolloLink, HttpLink } from '@apollo/client';
import { BatchHttpLink } from '@apollo/client/link/batch-http';
import { env } from '#/config/env';
import { Environment } from '#/utils/environment';

/**
 * Create a fetch function with timeout support using AbortController.
 *
 * Apollo's HttpLink passes its own `signal` in `init` — an AbortController
 * it aborts when a query's observable is torn down (component unmounts,
 * navigates away, or the query is otherwise cancelled). That signal must be
 * forwarded into our own controller, not overwritten: without this, walking
 * away from a screen mid-request never actually cancels the underlying
 * fetch — it keeps running in the background, holding a connection, and
 * competes with whatever the same query fires next time the screen is
 * revisited. Left unfixed, this is exactly the mechanism that turns a single
 * slow request into a growing pile of orphaned in-flight requests, some of
 * which then stall long enough to hit this timeout and go through
 * `retryLink`'s retries — the layered delay is what a hung `GetX` query
 * spanning ~30s (10s timeout × up to 3 attempts, see retryLink.ts) actually
 * traces back to.
 */
const createTimeoutFetch = (timeoutMs: number): typeof fetch => {
  return async (input, init) => {
    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    const incomingSignal = init?.signal;
    if (incomingSignal) {
      if (incomingSignal.aborted) {
        controller.abort();
      } else {
        incomingSignal.addEventListener('abort', () => controller.abort(), {
          once: true,
        });
      }
    }

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });
      return response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        if (timedOut) throw new Error(`Request timeout after ${timeoutMs}ms`);
        throw error; // cancelled by Apollo (query torn down), not a timeout
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  };
};

const apiConfig = Environment.getApiConfig();
const baseOptions = {
  uri: env.API_URL || apiConfig.baseUrl,
  headers: { 'Content-Type': 'application/json' },
  fetch: createTimeoutFetch(apiConfig.timeout),
};

// GraphQL batching — opt-in via env flag (default off). DO NOT ENABLE against
// the sous-chef API: it sets `allowBatchedHttpRequests: false` (verified in
// apps/api/src/main.ts — deliberate, for rate-limit integrity and a
// Cache-Control leak in batched responses), so every array-bodied POST is
// rejected. The bandwidth win is covered server-side by APQ (see
// persistedQueryLink) + HTTP/2 multiplexing. The flag stays only for
// hypothetical use against a server that accepts array bodies.
const batchEnabled = env.GRAPHQL_BATCH_ENABLED === 'true';

export const httpLink: ApolloLink = batchEnabled
  ? new BatchHttpLink({ ...baseOptions, batchMax: 10, batchInterval: 20 })
  : new HttpLink(baseOptions);
