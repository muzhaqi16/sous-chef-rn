import { ApolloLink, HttpLink } from '@apollo/client';
import { BatchHttpLink } from '@apollo/client/link/batch-http';
import { env } from '#/config/env';
import { Environment } from '#/utils/environment';

/**
 * Create a fetch function with timeout support using AbortController
 */
const createTimeoutFetch = (timeoutMs: number): typeof fetch => {
  return async (input, init) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });
      return response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeoutMs}ms`);
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
