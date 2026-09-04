/**
 * Server-enforced limits: query depth 10, 150 fields per query, 100 items per
 * request. Exceeding any of them is refused, not truncated.
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
  DEFAULT: 20,
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

/** Cap a requested page size at the server's per-request maximum. */
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
