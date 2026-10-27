/**
 * The catalog's testIDs. The add-item sheet and its pickers are hosted by other
 * features under a caller prefix (`add-pantry-item`, `add-shopping-item`), so
 * those ids are builders taking it. No imports: e2e reads this by relative path.
 */
export const catalogTestIDs = {
  addItemFormSubtitle: 'add-item-form-subtitle',
  barcodeInfoFormat: 'barcode-info-format',
  /** The review path's required note, `fields.tsx`'s `editReason`. */
  addItemFormEditNoteInput: 'add-item-form-edit-note-input',
  reportItemReasonInput: 'report-item-reason-input',
  reportItemCancelButton: 'report-item-cancel-button',
  reportItemSubmitButton: 'report-item-submit-button',
  dropdownSpacer: 'dropdown-spacer',
  /** `ItemPhotoViewer`'s "report wrong photo" on a public item's photo. */
  photoViewerReportButton: 'photo-viewer-report-button',
  /** `ItemPhotoViewer`'s "use this photo" for a household's entries. */
  photoViewerUseButton: 'photo-viewer-use-button',
  /** A detail screen's "change photo", and `EntryPhotoSheet`'s choices. */
  entryPhotoChangeButton: 'entry-photo-change-button',
  entryPhotoSheet: 'entry-photo-sheet',
  entryPhotoTake: 'entry-photo-take',
  entryPhotoChoose: 'entry-photo-choose',
  entryPhotoPickItemPhoto: 'entry-photo-pick-item-photo',
  entryPhotoUseCatalog: 'entry-photo-use-catalog',
  /** `PhotoCredit`: a licensed photo's credit and licence links. */
  photoCreditSource: 'photo-credit-source',
  photoCreditLicense: 'photo-credit-license',

  /** `AddItemSheet`, under its host's `testIDPrefix`. */
  addItemSheetModal: (prefix: string) => `${prefix}-modal`,
  addItemSheetSearchInput: (prefix: string) => `${prefix}-search-input`,
  addManuallyButton: (prefix: string) => `${prefix}-add-manually-button`,

  /** `SuggestionListItem` / `BottomSheetAutocompleteInput`, under the field's id. */
  suggestionDismiss: (fieldID: string) => `${fieldID}-dismiss`,
  suggestion: (fieldID: string, index: number) =>
    `${fieldID}-suggestion-${index}`,
  autocompleteSearch: (fieldID: string) => `${fieldID}-search`,
};
