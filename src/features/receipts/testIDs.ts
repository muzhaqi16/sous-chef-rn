/**
 * The receipts feature's testIDs, shared by the app and the e2e specs. No
 * imports: Detox's Jest reads this by relative path, outside the aliases.
 */
export const receiptsTestIDs = {
  scanScreen: 'receipt-scan-screen',
  savedReview: 'receipt-scan-saved-review',
  /** The server is picking out a saved receipt's items. */
  savedReading: 'receipt-scan-saved-reading',
  /** Lines of a saved receipt the API refused, to fix and add again. */
  savedFailed: 'receipt-scan-saved-failed',
  /** A saved receipt's check-in waits for a connection. */
  savedQueued: 'receipt-scan-saved-queued',
  /** The ask to send a receipt the phone could not read as photos. */
  photoSend: 'receipt-photo-send',
  reviewScreen: 'receipt-review-screen',
  reviewAdd: 'receipt-review-add',
  reviewTotalsGap: 'receipt-review-totals-gap',
  /** The note that the list is longer than the review could match against. */
  reviewListIncomplete: 'receipt-review-list-incomplete',
  /** The review's store field. */
  reviewStore: 'receipt-review-store',
  /** Where the receipt's store is; opens the store field. */
  reviewStoreWhere: 'receipt-review-store-where',
  /** A store on file with no address, offered to take the receipt's. */
  reviewStoreOffer: 'receipt-review-store-offer',
  /** The purchase date field; its calendar is the kit's `datePickerCalendar`. */
  reviewDate: 'receipt-review-date',
  /** The banner that asks the API again after a failed match. */
  reviewMatchRetry: 'receipt-review-match-retry',
  /** Ends the review with lines still open, once nothing is left to add. */
  reviewFinish: 'receipt-review-finish',
  /** Prefix of each line's row: `receipt-review-line-<index>`. */
  reviewLine: 'receipt-review-line',
  lineProduct: 'receipt-line-product',
  /** A proposed item's chip in the line sheet, best first. */
  lineSuggestion: (index: number) => `receipt-line-suggestion-${index}`,
  lineSave: 'receipt-line-save',
  lineTickOff: 'receipt-line-tick-off',
  lineNotStocked: 'receipt-line-not-stocked',
};
