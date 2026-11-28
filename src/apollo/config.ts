/**
 * Apollo LRU cache sizes: the document caches tuned down from Apollo's
 * defaults for mobile; the result caches at Apollo's own, since a small account
 * fills a smaller one (docs/performance-monitoring.md, Recorded measurements).
 * MUST be imported in index.js before any @apollo/client import — Apollo reads
 * this symbol once, at load.
 * @see https://www.apollographql.com/docs/react/caching/memory-management
 */

import type { CacheSizes } from '@apollo/client/utilities';

Object.assign(globalThis, {
  [Symbol.for('apollo.cacheSize')]: {
    // Document caches
    canonicalStringify: 1000, // Default: 1,000
    print: 1000, // Default: 2,000
    'documentTransform.cache': 500, // Default: 2,000

    // Query deduplication
    'queryManager.getDocumentInfo': 500,
  } satisfies Partial<CacheSizes>,
});
