/**
 * The barcode feature's testIDs, shared by the app and the e2e specs. No
 * imports: Detox's Jest reads this by relative path, outside the aliases.
 */
export const barcodeTestIDs = {
  /** `ProductResultCard`'s edit action: the press target, and its label. */
  productEditAction: 'product-result-edit-action',
  productEditActionLabel: 'product-result-edit-action-label',
  /** The pack-size prompt a product without a package size asks before adding. */
  packSizeInput: 'pack-size-input',
  packSizeConfirm: 'pack-size-confirm',
  /** The household's dietary alerts on a scan, and its offline note. */
  householdAlerts: 'household-alerts',
  householdUnchecked: 'household-unchecked',
  /** A product of the same kind that raises no alert. */
  householdAlternative: (itemId: string) => `household-alternative-${itemId}`,
};
