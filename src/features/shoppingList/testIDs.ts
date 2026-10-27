/**
 * The shopping list's testIDs, shared by the app and the e2e page objects. No
 * imports: Detox's Jest reads this by relative path, outside the aliases.
 */
export const shoppingListTestIDs = {
  screen: 'shopping-list-screen',
  listSelectorButton: 'shopping-list-selector',
  /** The selector's pending invitations; one invite and its answers, by its id. */
  pendingInvites: 'shopping-list-pending-invites',
  pendingInvite: (id: string) => `shopping-list-pending-invite-${id}`,
  pendingInviteAccept: (id: string) =>
    `shopping-list-pending-invite-${id}-accept`,
  pendingInviteDecline: (id: string) =>
    `shopping-list-pending-invite-${id}-decline`,
  searchInput: 'shopping-list-search-input',
  batchMoveToPantryButton: 'shopping-list-batch-move-pantry',
  moveToPantryPackageSizeUnit: 'move-to-pantry-package-size-unit',
  clearAllButton: 'shopping-list-clear-all',
  /** List settings: the store the list is shopped at. */
  listSettingsStore: 'list-settings-store',
  /** List settings: where the list is cheapest, and one candidate by its id. */
  storeComparison: 'list-store-comparison',
  listBudgetScreen: 'list-budget-screen',
  listBudgetStore: 'list-budget-store',
  budgetInput: 'list-budget-input',
  budgetRemaining: 'list-budget-remaining',
  priceTrackingSwitch: 'list-budget-price-tracking',
  budgetAndPricesButton: 'shopping-list-budget-and-prices',
  storeComparisonCandidate: (id: string) => `list-store-comparison-${id}`,

  /** `FilterTabBar`: tabs go through `kitTestIDs.filterTab` under this prefix. */
  tabBarPrefix: 'filter-tab',
  /** An action button that brings no testID of its own, by position. */
  tabBarAction: (index: number) => `filter-tab-action-${index}`,
  /** The header icon that opens store mode, and store mode's own parts. */
  storeModeButton: 'shopping-list-store-mode',
  storeModeScreen: 'store-mode-screen',
  storeModeDone: 'store-mode-done',
  storeModeScan: 'store-mode-scan',
  storeModeChooseStore: 'store-mode-choose-store',
  storeModeStoreField: 'store-mode-store-field',
  /** One aisle's heading, by its department. */
  aisleHeader: (department: string) => `shopping-list-aisle-${department}`,
  aisleRouteNote: 'shopping-list-aisle-route-note',
  /** Store mode's aisle row: tabs go through `kitTestIDs.filterTab` under this prefix. */
  aisleTabPrefix: 'store-mode-aisle-tab',

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
  purchasePriceError: 'purchase-price-error',
  /** What a typed price means, such as how it compares with the usual. */
  purchasePriceNote: 'purchase-price-note',

  itemDetail: 'shopping-item-detail',
  itemDetailEditButton: 'shopping-item-edit-button',
  itemDetailReportPhotoButton: 'shopping-item-report-photo-button',
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
