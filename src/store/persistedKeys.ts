/** The key the root store persists under. */
export const STORAGE_KEY = 'sous-chef-storage';

/** Keys a removed store persisted under, still on disk for older installs. */
export const RETIRED_PERSISTED_KEYS: readonly string[] = [
  // The barcode scanner's scan history (item names, brands, UPCs), before 4.7.0.
  'sous-chef-barcode',
  // Spoonacular results the app fetched itself, before recipe search moved
  // behind the API.
  'recipe-search-cache',
  'recipe-suggestions-cache',
];
