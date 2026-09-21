/**
 * Server-enforced limits: query depth 10, 150 fields per query, 100 items per
 * request. Exceeding any of them is refused, not truncated.
 */

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
