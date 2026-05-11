import { ApolloLink, HttpLink } from '@apollo/client';
import { BatchHttpLink } from '@apollo/client/link/batch-http';
import Config from 'react-native-config';
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
  uri: Config.API_URL || apiConfig.baseUrl,
  headers: { 'Content-Type': 'application/json' },
  fetch: createTimeoutFetch(apiConfig.timeout),
};

// GraphQL batching — opt-in via env flag (default off). When enabled, multiple
// concurrent operations are coalesced into a single POST as a JSON array. The
// server must support array-bodied POST requests at /graphql; if it doesn't,
// every operation will fail. Subscriptions are unaffected (routed via wsLink).
// File-upload mutations (if added later) need `context: { batchMax: 1 }` to
// bypass batching and send a multipart request individually.
const batchEnabled = Config.GRAPHQL_BATCH_ENABLED === 'true';

export const httpLink: ApolloLink = batchEnabled
  ? new BatchHttpLink({ ...baseOptions, batchMax: 10, batchInterval: 20 })
  : new HttpLink(baseOptions);
