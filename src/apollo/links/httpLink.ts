import { HttpLink } from '@apollo/client';
import Config from 'react-native-config';
import { Environment } from '#/utils/environment';

/**
 * Create a fetch function with timeout support using AbortController
 */
const createTimeoutFetch = (timeoutMs: number): typeof fetch => {
  return async (input, init) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const fetchStart = Date.now();

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });
      if (__DEV__) {
        const url = typeof input === 'string' ? input : input instanceof Request ? input.url : '';
        const opMatch = typeof init?.body === 'string' ? init.body.match(/"operationName":"(\w+)"/) : null;
        const label = opMatch?.[1] ?? url;
        console.log(`[fetch] ${label} ${Date.now() - fetchStart}ms`);
      }
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

export const httpLink = new HttpLink({
  uri: Config.API_URL || apiConfig.baseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
  fetch: createTimeoutFetch(apiConfig.timeout),
});
