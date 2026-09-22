/**
 * The onboarding steps' testIDs, shared by the app and the e2e page objects. No
 * imports: Detox's Jest reads this by relative path, outside the aliases.
 */
export const onboardingTestIDs = {
  createHomeScreen: 'onboarding-create-home-screen',
  createShoppingListScreen: 'onboarding-create-shopping-list-screen',
  selectPantryItemsScreen: 'onboarding-select-pantry-items-screen',
  inviteOfflineContinueButton: 'invite-offline-continue',
  biometricSetupScreen: 'biometric-setup-screen',
  /** The `BiometricSetupView` prefix; its buttons are `kitTestIDs.biometric*`. */
  biometricSetupView: 'biometric-setup',
  completeScreen: 'onboarding-complete-screen',

  /** `OnBoardingWrapper`'s header buttons, under the step screen's id. */
  backButton: (screenID: string) => `${screenID}-back-button`,
  skipButton: (screenID: string) => `${screenID}-skip-button`,
};
