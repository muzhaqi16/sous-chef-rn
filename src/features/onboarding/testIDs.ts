/**
 * The onboarding steps' testIDs, shared by the app and the e2e page objects. No
 * imports: Detox's Jest reads this by relative path, outside the aliases.
 */
export const onboardingTestIDs = {
  selectPantryItemsScreen: 'onboarding-select-pantry-items-screen',
  completeScreen: 'onboarding-complete-screen',

  /** `OnBoardingWrapper`'s header buttons, under the step screen's id. */
  skipButton: (screenID: string) => `${screenID}-skip-button`,
  /** "Step 2 of 3", shown beside the progress bar. */
  stepNumber: 'onboarding-step-number',
  /** The footer: primary action, step number and Skip. */
  footer: 'onboarding-footer',
  /** The setup screen, and its choices when invitations are pending. */
  setupScreen: 'onboarding-setup-screen',
  setupCreateHome: 'onboarding-setup-create-home',
  setupSkipHome: 'onboarding-setup-skip-home',
  /** The household question: who the user cooks for. */
  householdScreen: 'onboarding-household-screen',
  householdChoice: (choice: string) => `onboarding-household-${choice}`,
  householdFewer: 'onboarding-household-fewer',
  householdMore: 'onboarding-household-more',
  /** The dietary step, and each chosen allergen's Allergy / Intolerance control. */
  dietaryScreen: 'onboarding-dietary-screen',
  dietarySeverity: (value: string) => `onboarding-dietary-severity-${value}`,
  /** Opens the avoid-a-food sheet. */
  dietaryAddFood: 'onboarding-dietary-add-food',
  /** The receipt step: scan, staples instead, and how many a review added. */
  receiptScreen: 'onboarding-receipt-screen',
  receiptScan: 'onboarding-receipt-scan',
  receiptStaples: 'onboarding-receipt-staples',
  receiptAdded: 'onboarding-receipt-added',
  /** The completion screen's recipes and invite button. */
  payoff: 'onboarding-payoff',
  invite: 'onboarding-invite',
  /** A staples group, by the storage state it holds. */
  staplesGroup: (state: string) => `onboarding-staples-${state}`,
};
