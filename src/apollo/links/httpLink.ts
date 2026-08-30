import { ApolloLink, HttpLink } from '@apollo/client';
import { BatchHttpLink } from '@apollo/client/link/batch-http';
import { env } from '#/config/env';
import { Environment } from '#/utils/environment';

/**
 * A fetch with timeout support. Apollo's HttpLink passes its own `signal`,
 * aborted when a query's observable is torn down; it must be FORWARDED into our
 * controller rather than overwritten, or leaving a screen mid-request never
 * cancels the fetch and orphaned requests pile up behind the timeout.
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

// DO NOT ENABLE against the sous-chef API: it sets
// `allowBatchedHttpRequests: false`, so every array-bodied POST is rejected.
// APQ + HTTP/2 multiplexing already cover the bandwidth win. The flag remains
// only for a server that accepts array bodies.
const batchEnabled = env.GRAPHQL_BATCH_ENABLED === 'true';

export const httpLink: ApolloLink = batchEnabled
  ? new BatchHttpLink({ ...baseOptions, batchMax: 10, batchInterval: 20 })
  : new HttpLink(baseOptions);
