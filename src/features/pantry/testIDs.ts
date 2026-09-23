const ITEM = 'pantry-item';

/**
 * The pantry's testIDs, imported by the app and the e2e page objects alike. It
 * has no imports: Detox's Jest reads it by relative path, outside the aliases.
 */
export const pantryTestIDs = {
  screen: 'pantry-screen',
  loading: 'pantry-loading',
  greetingRow: 'pantry-greeting-row',
  list: 'pantry-list',
  listSkeletonOverlay: 'pantry-list-skeleton-overlay',
  refreshControl: 'pantry-refresh-control',
  searchInput: 'pantry-search-input',
  emptyState: 'pantry-empty-state',
  sortButton: 'pantry-sort-button',
  sortModal: 'pantry-sort-modal',
  /** `FilterTabs` prefix of the storage-location strip. */
  locationTabPrefix: 'pantry-location-tab',
  addAllLowStockButton: 'add-all-low-stock',

  itemDetail: 'pantry-item-detail',
  itemDiscardButton: 'pantry-item-discard-button',
  itemAddToListButton: 'pantry-item-add-to-list-button',
  itemAdjustButton: 'pantry-item-adjust-button',
  itemEditButton: 'pantry-item-edit-button',
  itemDeleteButton: 'pantry-item-delete-button',

  /** `testIDPrefix` of the catalog's add-item sheet when the pantry hosts it. */
  addItemSheetPrefix: 'add-pantry-item',
  addDetailsModal: 'add-pantry-item-details-modal',
  addDetailsTitle: 'add-pantry-item-title',
  addDetailsNameInput: 'add-pantry-item-name-input',
  addDetailsQuantityInput: 'add-pantry-item-quantity-input',
  addDetailsUnitPicker: 'add-pantry-item-unit-picker',
  addDetailsSubmitButton: 'add-pantry-item-submit-button',
  addDetailsCancelButton: 'add-pantry-item-cancel-button',

  editItemModal: 'edit-pantry-item-modal',
  editItemSubmitButton: 'edit-pantry-item-submit-button',
  editItemQuantityInput: 'edit-pantry-item-quantity-input',
  editItemUnitPicker: 'edit-pantry-item-unit-picker',

  unitChangeConfirm: 'unit-change-confirm',
  unitChangeAmount: 'unit-change-amount',
  unitChangeSummary: 'unit-change-summary',
  unitChangeError: 'unit-change-error',

  sortOption: (key: string) => `pantry-sort-option-${key}`,
  /** The add-details sheet's page indicator, by page index. */
  addDetailsPage: (index: number) => `add-pantry-item-page-${index}`,
  /** A row by its item id; it is also the row's swipe-action prefix. */
  item: (itemId: string) => `${ITEM}-${itemId}`,
  itemQuantity: (itemId: string) => `${ITEM}-${itemId}-quantity`,
  /** A swipe action on any row, for a test that cannot know the item id. */
  anyItemSwipeAction: (actionKey: string) =>
    new RegExp(`^${ITEM}-.+-${actionKey}$`),
};
