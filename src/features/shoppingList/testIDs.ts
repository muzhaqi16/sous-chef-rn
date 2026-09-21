/**
 * The shopping list's testIDs, shared by the app and the e2e page objects. No
 * imports: Detox's Jest reads this by relative path, outside the aliases.
 */
export const shoppingListTestIDs = {
  screen: 'shopping-list-screen',
  listSelectorButton: 'shopping-list-selector',
  searchInput: 'shopping-list-search-input',
  batchMoveToPantryButton: 'shopping-list-batch-move-pantry',
  clearAllButton: 'shopping-list-clear-all',

  /** `FilterTabBar`: tabs go through `kitTestIDs.filterTab` under this prefix. */
  tabBarPrefix: 'filter-tab',
  /** An action button that brings no testID of its own, by position. */
  tabBarAction: (index: number) => `filter-tab-action-${index}`,

  /** The add-item sheet's host prefix, for the `catalogTestIDs` sheet builders. */
  addSheetPrefix: 'add-shopping-item',
  addSheetDetails: 'add-shopping-item-details',
  addSheetTitle: 'add-shopping-item-title',
  addSheetScroll: 'add-shopping-item-scroll',
  addSheetSubmitButton: 'add-shopping-item-submit-button',
  addSheetCancelButton: 'add-shopping-item-cancel-button',
  addSheetNameInput: 'add-shopping-item-name-input',
  addSheetQuantityInput: 'add-shopping-item-quantity-input',
  addSheetUnitPicker: 'add-shopping-item-unit-picker',

  /** A row, keyed by item id; `SwipeableItem` appends its action keys to it. */
  itemRow: (itemId: string) => `shopping-list-item-${itemId}`,
  itemQuantity: (itemId: string) => `shopping-list-item-${itemId}-quantity`,
  itemMoveToPantry: (itemId: string) =>
    `shopping-list-item-${itemId}-move-to-pantry`,
  itemStocked: (itemId: string) => `shopping-list-item-${itemId}-stocked`,
  /** The row's "still waiting to sync" marker. */
  itemPendingSync: (itemId: string) =>
    `shopping-list-item-${itemId}-pending-sync`,
  itemCheckbox: (itemId: string) => `shopping-item-checkbox-${itemId}`,
  /**
   * Any row's control by the suffix after the item id — a swipe action key or
   * `quantity`. The id sits in the middle, so `shopping-list-item-edit` never renders.
   */
  anyItemControl: (suffix: string) =>
    new RegExp(`^shopping-list-item-.+-${suffix}$`),
  anyItemCheckbox: () => /^shopping-item-checkbox-.+$/,

  quantityEditSaveButton: 'quantity-edit-save',
  quantityEditDecrement: 'quantity-edit-decrement',
  quantityEditIncrement: 'quantity-edit-increment',
  quantityEditValue: 'quantity-edit-value',
  quantityEditInput: 'quantity-edit-input',
  quantityEditFormatHint: 'quantity-edit-format-hint',

  purchaseQuantityInput: 'purchase-quantity-input',
  purchaseQuantityError: 'purchase-quantity-error',
  purchasePriceInput: 'purchase-price-input',

  itemDetail: 'shopping-item-detail',
  itemDetailEditButton: 'shopping-item-edit-button',
  itemDetailHeroImage: 'shopping-item-hero-image',

  /** `AddEditItem`, adding; `editItemForm` carries the same keys. */
  addItemForm: {
    screen: 'add-item-modal',
    submitButton: 'add-item-submit-button',
    nameInput: 'add-item-name-input',
    brandInput: 'add-item-brand-input',
    quantityInput: 'add-item-quantity-input',
    unitPicker: 'add-item-unit-picker',
    netWeightInput: 'add-item-net-weight-input',
    netWeightUnitPicker: 'add-item-net-weight-unit-picker',
    priceInput: 'add-item-price-input',
  },
  editItemForm: {
    screen: 'edit-item-modal',
    submitButton: 'edit-item-submit-button',
    nameInput: 'edit-item-name-input',
    brandInput: 'edit-item-brand-input',
    quantityInput: 'edit-item-quantity-input',
    unitPicker: 'edit-item-unit-picker',
    netWeightInput: 'edit-item-net-weight-input',
    netWeightUnitPicker: 'edit-item-net-weight-unit-picker',
    priceInput: 'edit-item-price-input',
  },
};
