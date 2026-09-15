/**
 * The catalog's testIDs. The add-item sheet and its pickers are hosted by other
 * features under a caller prefix (`add-pantry-item`, `add-shopping-item`), so
 * those ids are builders taking it. No imports: e2e reads this by relative path.
 */
export const catalogTestIDs = {
  addItemFormSubtitle: 'add-item-form-subtitle',
  /** The review path's required note, `fields.tsx`'s `editReason`. */
  addItemFormEditNoteInput: 'add-item-form-edit-note-input',
  reportItemReasonInput: 'report-item-reason-input',
  reportItemCancelButton: 'report-item-cancel-button',
  reportItemSubmitButton: 'report-item-submit-button',
  dropdownSpacer: 'dropdown-spacer',

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
