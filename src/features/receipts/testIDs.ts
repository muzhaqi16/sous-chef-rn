/**
 * The receipts feature's testIDs, shared by the app and the e2e specs. No
 * imports: Detox's Jest reads this by relative path, outside the aliases.
 */
export const receiptsTestIDs = {
  scanScreen: 'receipt-scan-screen',
  savedText: 'receipt-scan-saved-text',
  savedReview: 'receipt-scan-saved-review',
  /** The server is picking out a saved receipt's items. */
  savedReading: 'receipt-scan-saved-reading',
  reviewScreen: 'receipt-review-screen',
  reviewAdd: 'receipt-review-add',
  reviewTotalsGap: 'receipt-review-totals-gap',
  /** Prefix of each line's row: `receipt-review-line-<index>`. */
  reviewLine: 'receipt-review-line',
  lineProduct: 'receipt-line-product',
  /** A proposed item's chip in the line sheet, best first. */
  lineSuggestion: (index: number) => `receipt-line-suggestion-${index}`,
  lineSave: 'receipt-line-save',
  lineTickOff: 'receipt-line-tick-off',
};
