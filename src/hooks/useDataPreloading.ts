/**
 * Preloads essential reference data for offline access.
 *
 * Currently a shell — common units preloading was moved to useUnitAutocomplete
 * (lazy, fires on first AddItemSheet open instead of startup).
 *
 * Add future reference data preloads here (categories, brands, etc.)
 * when they need to be cached at the app level.
 */
export function useDataPreloading() {
  // Future reference data preloads go here.
  // Units are now lazily loaded in useUnitAutocomplete on first use.
}
