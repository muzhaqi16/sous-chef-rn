/**
 * The onboarding steps' testIDs, shared by the app and the e2e page objects. No
 * imports: Detox's Jest reads this by relative path, outside the aliases.
 */
export const onboardingTestIDs = {
  completeScreen: 'onboarding-complete-screen',
  /** The completion screen's drawn check. */
  completionCheck: 'onboarding-completion-check',
  /** A summary line on the completion screen, by what it says was done. */
  summaryLine: (kind: string) => `onboarding-summary-${kind}`,

  /** `OnboardingStepScaffold`'s header buttons, under the step screen's id. */
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
  householdGreeting: 'onboarding-household-greeting',
  householdHomeName: 'onboarding-household-home-name',
  renameHomeInput: 'onboarding-rename-home-input',
  renameHomeSave: 'onboarding-rename-home-save',
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
  receiptAdded: 'onboarding-receipt-added',
  /** The receipt step while setup has not left a pantry yet. */
  receiptSetupRunning: 'onboarding-receipt-setup-running',
  receiptSetupFailed: 'onboarding-receipt-setup-failed',
  /** The receipt step offline: scanning and staples wait for a connection. */
  receiptOffline: 'onboarding-receipt-offline',
  /** The completion screen's invite button and store offer. */
  invite: 'onboarding-invite',
  stores: 'onboarding-stores',
  /** A staples group, by the storage state it holds. */
  staplesGroup: (state: string) => `onboarding-staples-${state}`,
};
