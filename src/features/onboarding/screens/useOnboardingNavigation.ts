import { CommonActions } from '@react-navigation/native';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useNavigationUtils } from '#store/useAppStore';
import { OnBoardingSteps } from '#store/slices/navigationSlice';
import { logger } from '#/utils/environment';
import type { OnboardingStackParams } from '#navigation/stacks/OnboardingStack';

// A step is an onboarding route; `ImageCrop` is a route the flow passes through.
export type OnboardingStepId = Exclude<
  keyof OnboardingStackParams,
  'ImageCrop'
>;

// The one definition of the flow, exported so nothing else declares a second.
// Currency is NOT a step: it is inferred from the device region on first
// sign-in (`deviceRegionCurrency`) and corrected in Profile, because asking it
// here costs a step to answer a question the device already answers.
export const ONBOARDING_STEPS: readonly OnboardingStepId[] = [
  'CreateHome',
  'CreateShoppingList',
  'SelectPantryItems',
  'ProfilePictureUpload',
  'InviteMembers',
  'BiometricSetup',
  'OnboardingComplete',
];

const STEP_TO_ENUM: Record<OnboardingStepId, OnBoardingSteps> = {
  CreateHome: OnBoardingSteps.createHome,
  CreateShoppingList: OnBoardingSteps.createShoppingList,
  SelectPantryItems: OnBoardingSteps.selectPantryItems,
  ProfilePictureUpload: OnBoardingSteps.profilePictureUpload,
  InviteMembers: OnBoardingSteps.inviteMembers,
  BiometricSetup: OnBoardingSteps.complete, // Temporarily using complete enum
  OnboardingComplete: OnBoardingSteps.complete,
};

export const onboardingStepIndex = (name: string): number =>
  ONBOARDING_STEPS.findIndex(step => step === name);

export function useOnboardingNavigation() {
  // The raw prop: this hook dispatches reset/navigate actions and reads the
  // stack state, none of which the typed wrapper's named methods express.
  const { navigation } = useAppNavigation();
  const { setOnBoardingStep, setUserNavigationState } = useNavigationUtils();

  const navigateToNextStep = (currentScreen: OnboardingStepId) => {
    const currentIndex = onboardingStepIndex(currentScreen);
    if (currentIndex < 0) {
      logger.warn(`Onboarding step not in the flow: ${currentScreen}`);
      return;
    }
    if (currentIndex < ONBOARDING_STEPS.length - 1) {
      const nextScreen = ONBOARDING_STEPS[currentIndex + 1];
      if (!nextScreen) return;

      // When navigating to OnboardingComplete, reset the stack to prevent back navigation
      if (nextScreen === 'OnboardingComplete') {
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: nextScreen }],
          }),
        );
      } else {
        navigation.dispatch(CommonActions.navigate(nextScreen));
      }

      setOnBoardingStep(STEP_TO_ENUM[nextScreen]);
    }
  };

  const navigateToPreviousStep = (currentScreen: OnboardingStepId) => {
    const currentIndex = onboardingStepIndex(currentScreen);
    if (currentIndex < 0) {
      logger.warn(`Onboarding step not in the flow: ${currentScreen}`);
      return;
    }
    if (currentIndex > 0) {
      const previousScreen = ONBOARDING_STEPS[currentIndex - 1];
      if (!previousScreen) return;
      navigation.dispatch(CommonActions.navigate(previousScreen));

      setOnBoardingStep(STEP_TO_ENUM[previousScreen]);
    }
  };

  const skipToStep = (stepName: OnboardingStepId) => {
    navigation.dispatch(CommonActions.navigate(stepName));
    setOnBoardingStep(STEP_TO_ENUM[stepName]);
  };

  return {
    navigateToNextStep,
    navigateToPreviousStep,
    skipToStep,
    setUserNavigationState,
  };
}
