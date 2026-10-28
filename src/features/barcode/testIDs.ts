/**
 * The barcode feature's testIDs, shared by the app and the e2e specs. No
 * imports: Detox's Jest reads this by relative path, outside the aliases.
 */
export const barcodeTestIDs = {
  /** `ProductResultCard`'s edit action: the press target, and its label. */
  productEditAction: 'product-result-edit-action',
  productEditActionLabel: 'product-result-edit-action-label',
  /** What a pantry add records: its summary, which opens the fields below. */
  scanAmountSummary: 'scan-amount-summary',
  scanAmountQuantity: 'scan-amount-quantity',
  scanAmountUnit: 'scan-amount-unit',
  scanAmountPackaged: 'scan-amount-packaged',
  scanAmountSize: 'scan-amount-size',
  scanAmountUsedIn: 'scan-amount-used-in',
  /** The scanned product's nutrition card. */
  productNutrition: 'product-nutrition',
  /** The household's dietary alerts on a scan, and its offline note. */
  householdAlerts: 'household-alerts',
  householdUnchecked: 'household-unchecked',
  /** A product of the same kind that raises no alert. */
  householdAlternative: (itemId: string) => `household-alternative-${itemId}`,
  /** Store mode's price lines on a scan, and its shelf price at each store. */
  storePrices: 'store-prices',
  storeShelfPrices: 'store-shelf-prices',
  /** Where a scanned product comes from and who owns its brand. */
  productOrigin: 'product-origin',
  /** The user's own lists a scanned brand is on, and the add action. */
  brandListings: 'brand-listings',
  addBrandToList: 'add-brand-to-list',
};
