import { BatchHttpLink } from '@apollo/client/link/batch-http';
import Config from 'react-native-config';
import { Environment } from '#/utils/environment';

export const batchLink = new BatchHttpLink({
  // Use Config.API_URL from .env if set, otherwise use environment-specific default
  uri: Config.API_URL || Environment.getApiConfig().baseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
  batchMax: 10, // Maximum number of operations to batch
  batchInterval: 20, // Wait 20ms to collect operations for batching
  batchKey: operation => {
    // Batch operations with same context (e.g., same auth headers)
    const context = operation.getContext();
    return JSON.stringify({
      uri: context.uri || '',
      headers: context.headers || {},
    });
  },
});
