/** The key the root store persists under. */
export const STORAGE_KEY = 'sous-chef-storage';

/** Keys a removed store persisted under, still on disk for older installs. */
export const RETIRED_PERSISTED_KEYS: readonly string[] = [
  // The barcode scanner's scan history (item names, brands, UPCs), before 4.7.0.
  'sous-chef-barcode',
];
