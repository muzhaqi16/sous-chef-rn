/**
 * A list's items per page. Every page append re-runs the whole items pipeline
 * (cache merge → query broadcast → extract → wrap → list), so fewer, larger
 * pages cost less than many small ones, as profiling a 95-item list shows.
 */
export const SHOPPING_ITEMS_PAGE_SIZE = 25;
