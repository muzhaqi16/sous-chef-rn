/**
 * Apollo LRU cache sizes, tuned down from Apollo's desktop defaults for mobile.
 * MUST be imported in index.js before any @apollo/client import — Apollo reads
 * this symbol once, at load.
 * @see https://www.apollographql.com/docs/react/caching/memory-management
 */

import type { CacheSizes } from '@apollo/client/utilities';
import { logger } from '#/utils/environment';

// @ts-expect-error -- globalThis symbol indexing (Apollo's documented API)
globalThis[Symbol.for('apollo.cacheSize')] = {
  // Core caches - sized for mobile (queries visible on screen at once)
  'inMemoryCache.executeSelectionSet': 3000, // Default: 10,000 - increased for 126+ entities
  'inMemoryCache.executeSubSelectedArray': 2000, // Default: 5,000 - increased to reduce cache thrashing
  'inMemoryCache.maybeBroadcastWatch': 2000, // Default: 5,000 - increased to reduce cache thrashing

  // Document caches
  canonicalStringify: 1000, // Default: 1,000
  print: 1000, // Default: 2,000
  'documentTransform.cache': 500, // Default: 2,000

  // Fragment registry
  'fragmentRegistry.lookup': 200, // Fragment lookups
  'fragmentRegistry.findFragmentSpreads': 100,

  // Query deduplication
  'queryManager.getDocumentInfo': 500,
} satisfies Partial<CacheSizes>;

logger.debug('🔧 Apollo: Memory management configured for mobile');
