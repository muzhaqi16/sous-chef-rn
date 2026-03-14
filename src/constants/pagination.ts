/**
 * Pagination Constants
 *
 * API Limits (enforced by server):
 * - Maximum query depth: 10 levels
 * - Maximum fields: 150 fields per query
 * - Maximum pagination: 100 items per request
 *
 * Use these constants to ensure compliance with API limits
 */

/**
 * Maximum number of items that can be requested in a single query
 * Enforced by API - exceeding this will result in PAGINATION_LIMIT_EXCEEDED error
 */
export const MAX_PAGINATION_LIMIT = 100;

/**
 * Default pagination sizes for different use cases
 */
export const PAGE_SIZE = {
  /** Compact lists (e.g., storage locations, dropdowns) */
  COMPACT: 15,
  /** Standard paginated lists (e.g., pantry items, shopping lists) */
  DEFAULT: 15,
  /** Infinite scroll increment */
  SCROLL: 30,
  /** Larger datasets (e.g., hybrid sort threshold) */
  EXTENDED: 50,
  /** API maximum */
  MAX: 100,
};

/**
 * Maximum query depth allowed by API
 * Queries with nesting deeper than this will be rejected
 */
export const MAX_QUERY_DEPTH = 10;

/**
 * Maximum fields allowed per query
 * Queries requesting more fields will be rejected
 */
export const MAX_QUERY_FIELDS = 150;

/**
 * Validate and cap pagination parameter to API limit
 *
 * @param value - Requested pagination value
 * @returns Capped value (max 100)
 *
 * @example
 * ```typescript
 * const first = capPagination(500); // Returns 100
 * const first = capPagination(50);  // Returns 50
 * ```
 */
export function capPagination(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  return Math.min(value, MAX_PAGINATION_LIMIT);
}

/**
 * Validate pagination parameters for a query
 *
 * @param params - Pagination parameters
 * @returns Validated parameters (capped at max)
 */
export function validatePagination(params: {
  first?: number;
  last?: number;
  limit?: number;
  take?: number;
}) {
  return {
    first: capPagination(params.first),
    last: capPagination(params.last),
    limit: capPagination(params.limit),
    take: capPagination(params.take),
  };
}
