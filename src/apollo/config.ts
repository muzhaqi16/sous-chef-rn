/**
 * Apollo Client Memory Management Configuration
 *
 * Per Apollo docs: "Set before loading @apollo/client"
 * This file MUST be imported in index.js before any Apollo Client imports
 *
 * Mobile-optimized cache sizes for React Native
 * Default values are tuned for desktop/web with much larger memory footprints
 *
 * LRU Cache Configuration:
 * - Core caches sized for mobile (typical queries visible on screen at once)
 * - Document caches sized for typical app operations
 * - Fragment registry sized conservatively
 * - Query manager sized for typical concurrent queries
 *
 * @see https://www.apollographql.com/docs/react/caching/memory-management
 */

/* eslint-disable no-undef */
// @ts-expect-error - Apollo Client uses Symbol.for() to configure LRU cache sizes
globalThis[Symbol.for('apollo.cacheSize')] = {
  // Core caches - sized for mobile (queries visible on screen at once)
  'inMemoryCache.executeSelectionSet': 3000, // Default: 10,000 - increased for 126+ entities
  'inMemoryCache.executeSubSelectedArray': 2000, // Default: 5,000 - increased to reduce cache thrashing
  'inMemoryCache.maybeBroadcastWatch': 2000, // Default: 5,000 - increased to reduce cache thrashing

  // Document caches
  parser: 500, // User-supplied DocumentNodes - base value
  canonicalStringify: 1000, // 2x base value for transformed docs
  print: 1000, // 2x base value for printed queries
  'documentTransform.cache': 500, // Transform cache

  // Fragment registry
  'fragmentRegistry.lookup': 200, // Fragment lookups
  'fragmentRegistry.findFragmentSpreads': 100,

  // Query deduplication
  'queryManager.getDocumentInfo': 500,
  'queryManager.getVariables': 500,
};
/* eslint-enable no-undef */

console.log('🔧 Apollo: Memory management configured for mobile');
