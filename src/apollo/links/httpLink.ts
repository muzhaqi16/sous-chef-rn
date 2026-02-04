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

export const httpLink = new HttpLink({
  uri: Config.API_URL || apiConfig.baseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
  fetch: createTimeoutFetch(apiConfig.timeout),
});
