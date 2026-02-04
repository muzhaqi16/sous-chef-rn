/**
 * Shopping List Constants
 *
 * Centralized constants for shopping list features
 */

/**
 * GraphQL fragment names for cache operations
 */
export const FRAGMENT_NAMES = {
  ITEM_VERSION_DATA: 'ItemVersionData',
  ITEM_VERSION_DATA_2: 'ItemVersionData2',
} as const;

/**
 * Icon names used in shopping list UI
 */
export const ICONS = {
  ADD: 'add',
  REFRESH: 'refresh',
  SCANNER: 'barcode-scan',
  LIST_SELECT: 'list',
  SEARCH: 'search',
  EDIT: 'create-outline',
  DELETE: 'trash-outline',
  CHECKMARK: 'checkmark',
} as const;

/**
 * Action labels and text
 */
export const LABELS = {
  ADD_ITEM: 'Add Item',
  REFRESH: 'Refresh',
  SCAN_BARCODE: 'Scan Barcode',
  SELECT_LIST: 'Select List',
  NO_LISTS: 'No Shopping Lists',
  NO_ITEMS: 'No Items',
  CREATE_LIST: 'Create List',
  ADD_FIRST_ITEM: 'Add First Item',
} as const;

/**
 * Empty state messages
 */
export const EMPTY_STATE_MESSAGES = {
  NO_LISTS_TITLE: 'No Shopping Lists',
  NO_LISTS_SUBTITLE: 'Create your first shopping list to get started',
  NO_ITEMS_TITLE: 'Your list is empty',
  NO_ITEMS_SUBTITLE: 'Add items to your shopping list',
} as const;

/**
 * Pagination configuration for shopping list items
 */
export const PAGINATION = {
  /** Number of items to fetch per page in shopping list queries */
  ITEMS_PAGE_SIZE: 40,
} as const;

/**
 * Default values and configuration
 */
export const DEFAULTS = {
  SKELETON_COUNT: 5,
  REFRESH_DELAY: 300, // ms
} as const;
