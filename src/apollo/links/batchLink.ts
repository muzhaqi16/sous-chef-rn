import { BatchHttpLink } from '@apollo/client/link/batch-http';
import Config from 'react-native-config';

export const batchLink = new BatchHttpLink({
  uri: Config.API_URL || 'http://localhost:4000/graphql',
  batchMax: 10, // Maximum number of operations to batch
  batchInterval: 20, // Wait 20ms to collect operations for batching
  batchKey: (operation) => {
    // Batch operations with same context (e.g., same auth headers)
    const context = operation.getContext();
    return JSON.stringify({
      uri: context.uri || '',
      headers: context.headers || {},
    });
  },
});