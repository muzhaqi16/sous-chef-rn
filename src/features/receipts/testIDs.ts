/**
 * The receipts feature's testIDs, shared by the app and the e2e specs. No
 * imports: Detox's Jest reads this by relative path, outside the aliases.
 */
export const receiptsTestIDs = {
  scanScreen: 'receipt-scan-screen',
  savedReview: 'receipt-scan-saved-review',
  /** The server is picking out a saved receipt's items. */
  savedReading: 'receipt-scan-saved-reading',
  /** The ask to send a receipt the phone could not read as photos. */
  photoSend: 'receipt-photo-send',
  reviewScreen: 'receipt-review-screen',
  reviewAdd: 'receipt-review-add',
  reviewTotalsGap: 'receipt-review-totals-gap',
  /** The review's store and purchase-date fields. */
  reviewStore: 'receipt-review-store',
  reviewDate: 'receipt-review-date',
  /** A date read from the receipt, shown as text; it opens the date field. */
  reviewDateRow: 'receipt-review-date-row',
  /** The banner that asks the API again after a failed match. */
  reviewMatchRetry: 'receipt-review-match-retry',
  /** Prefix of each line's row: `receipt-review-line-<index>`. */
  reviewLine: 'receipt-review-line',
  lineProduct: 'receipt-line-product',
  /** A proposed item's chip in the line sheet, best first. */
  lineSuggestion: (index: number) => `receipt-line-suggestion-${index}`,
  lineSave: 'receipt-line-save',
  lineTickOff: 'receipt-line-tick-off',
};
