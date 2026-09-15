/**
 * Shopping List Constants
 *
 * Centralized constants for shopping list features
 */

/**
 * Pagination configuration for shopping list items
 */
export const PAGINATION = {
  /**
   * Number of items to fetch per page in shopping list queries. Every page
   * append re-runs the whole items pipeline (cache merge → query broadcast →
   * extract → wrap → list), so fewer, larger pages cost less than many small
   * ones, as profiling a 95-item list shows.
   */
  ITEMS_PAGE_SIZE: 25,
};
