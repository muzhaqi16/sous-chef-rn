import { useNavigation, CommonActions } from '@react-navigation/native';
import { useShallow } from 'zustand/shallow';
import { useAppStore, selectUser, selectNavigationUtils } from '#store/useAppStore';
import { OnBoardingSteps } from '#store/slices/navigationSlice';

const ONBOARDING_STEPS = [
  'CreateHome',
  'CreateShoppingList',
  'SelectPantryItems',
  'ProfilePictureUpload',
  'InviteMembers',
  'BiometricSetup',
  'OnboardingComplete',
];

const STEP_TO_ENUM: Record<string, OnBoardingSteps> = {
  CreateHome: OnBoardingSteps.createHome,
  CreateShoppingList: OnBoardingSteps.createShoppingList,
  SelectPantryItems: OnBoardingSteps.selectPantryItems,
  ProfilePictureUpload: OnBoardingSteps.profilePictureUpload,
  InviteMembers: OnBoardingSteps.inviteMembers,
  BiometricSetup: OnBoardingSteps.complete, // Temporarily using complete enum
  OnboardingComplete: OnBoardingSteps.complete };

export function useOnboardingNavigation() {
  const navigation = useNavigation();
  const {setOnBoardingStep, setOnboarded, setUserNavigationState, getUserNavigationState} = useAppStore(useShallow(selectNavigationUtils));
  const user = useAppStore(selectUser);

  const getCurrentStepIndex = (screenName: string) => {
    return ONBOARDING_STEPS.indexOf(screenName);
  };

  const navigateToNextStep = (currentScreen: string) => {
      const currentIndex = getCurrentStepIndex(currentScreen);
      if (currentIndex < ONBOARDING_STEPS.length - 1) {
        const nextScreen = ONBOARDING_STEPS[currentIndex + 1];

        // When navigating to OnboardingComplete, reset the stack to prevent back navigation
        if (nextScreen === 'OnboardingComplete') {
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: nextScreen }] }),
          );
        } else {
          navigation.dispatch(CommonActions.navigate(nextScreen));
        }

        // Update store with enum value
        const stepEnum = STEP_TO_ENUM[nextScreen];
        if (stepEnum) {
          setOnBoardingStep(stepEnum);
        }
      }
    };

  const navigateToPreviousStep = (currentScreen: string) => {
      const currentIndex = getCurrentStepIndex(currentScreen);
      if (currentIndex > 0) {
        const previousScreen = ONBOARDING_STEPS[currentIndex - 1];
        navigation.dispatch(CommonActions.navigate(previousScreen));

        // Update store with enum value
        const stepEnum = STEP_TO_ENUM[previousScreen];
        if (stepEnum) {
          setOnBoardingStep(stepEnum);
        }
      }
    };

  const skipToStep = (stepName: string) => {
      if (ONBOARDING_STEPS.includes(stepName)) {
        navigation.dispatch(CommonActions.navigate(stepName));

        // Update store with enum value
        const stepEnum = STEP_TO_ENUM[stepName];
        if (stepEnum) {
          setOnBoardingStep(stepEnum);
        }
      }
    };

  const completeOnboarding = () => {
    if (!user) {
      console.warn('Cannot complete onboarding without user');
      return false;
    }

    // Mark user as onboarded - this triggers automatic navigation to Home
    setOnboarded(true);
    setOnBoardingStep(null);

    // Track completion
    if (user.id) {
      setUserNavigationState(user.id, {
        hasCompletedOnboarding: true,
        onboardingCompletedAt: Date.now() });
    }

    return true;
  };

  // Helper to get progress percentage
  const getProgressPercentage = () => {
    const state = navigation.getState();
    const currentStep = state?.routes[state?.index ?? 0]?.name;
    const currentIndex = ONBOARDING_STEPS.indexOf(currentStep as string);

    if (currentIndex === -1) return 0;
    return Math.round(((currentIndex + 1) / ONBOARDING_STEPS.length) * 100);
  };

  return {
    steps: ONBOARDING_STEPS,
    navigateToNextStep,
    navigateToPreviousStep,
    skipToStep,
    completeOnboarding,
    getCurrentStepIndex,
    getProgressPercentage,
    setUserNavigationState,
    getUserNavigationState };
}
