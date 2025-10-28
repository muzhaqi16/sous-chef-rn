/**
 * Apollo Client utility hooks
 *
 * This module provides reusable hooks for working with Apollo Client
 * in a consistent and type-safe manner.
 */

// Subscription utilities
export { useStandardSubscription } from './useStandardSubscription';

// Query data preservation utilities
export {
  usePreservedQueryData,
  usePreservedArrayData,
} from './usePreservedQueryData';
