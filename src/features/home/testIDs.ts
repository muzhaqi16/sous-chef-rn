/**
 * The home feature's testIDs, shared by the app and the e2e page objects. No
 * imports: Detox's Jest reads this by relative path, outside the aliases.
 */
export const homeTestIDs = {
  homeActions: 'home-actions',
  managementAddButton: 'home-management-add-button',
  createHomeNameInput: 'create-home-name-input',
  createHomeCancelButton: 'create-home-cancel-button',
  createHomeSubmitButton: 'create-home-submit-button',
  /** The home details entry that opens the household's dietary needs. */
  dietaryNeedsRow: 'home-dietary-needs-row',
  dietaryNeedsScreen: 'home-dietary-needs-screen',
  /** The home details entry that opens the household's usual stores. */
  usualStoresRow: 'home-usual-stores-row',
  /** One sharing member's card on the dietary needs screen. */
  dietaryNeedsMember: (membershipId: string) =>
    `home-dietary-needs-member-${membershipId}`,
};
