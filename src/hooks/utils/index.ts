/**
 * Utility Hooks
 *
 * Reusable hooks for common patterns
 */

export { usePagination, type PaginationConfig, type UsePaginationReturn } from './usePagination';
export {
  useCrudOperations,
  type CreateOperationConfig,
  type UpdateOperationConfig,
  type RemoveOperationConfig,
} from './useCrudOperations';
export { useStableRef } from './useStableRef';
