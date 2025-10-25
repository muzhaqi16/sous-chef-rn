import { ApolloClient } from '@apollo/client';
import { createLink } from './links';
import { makeCache } from './cache';

/**
 * Initialize Apollo Client with VANILLA configuration
 *
 * All offline/persistence features removed to isolate normalization issues
 * Using Apollo defaults to let it handle everything automatically
 */
function initializeClient() {
  console.log('🚀 Apollo: Initializing with vanilla configuration (no persistence, no offline)');

  // Create cache instance with minimal config
  const cache = makeCache();

  // Create link chain
  const link = createLink();

  // Create Apollo Client with defaults
  const client = new ApolloClient({
    link,
    cache,
    // Configure to watch cache changes from mutations
    defaultOptions: {
      query: {
        fetchPolicy: 'cache-first',
        errorPolicy: 'all',
      },
      mutate: {
        errorPolicy: 'all',
      },
      watchQuery: {
        // Watch cache changes so queries re-emit when mutations update entities
        fetchPolicy: 'cache-and-network',
        // After initial fetch, use cache-first for performance
        nextFetchPolicy: 'cache-first',
        errorPolicy: 'ignore',
      },
    },
    queryDeduplication: true,
  });

  console.log('✅ Apollo: Client initialized (vanilla mode)');
  return client;
}

// Initialize client synchronously
export const client = initializeClient();
