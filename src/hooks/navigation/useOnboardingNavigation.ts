import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '#store';
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
  OnboardingComplete: OnBoardingSteps.complete,
};

export function useOnboardingNavigation() {
  const navigation = useNavigation();
  const {
    setOnBoardingStep,
    setOnboarded,
    setUserNavigationState,
    getUserNavigationState,
    user,
  } = useStore();

  const getCurrentStepIndex = useCallback((screenName: string) => {
    return ONBOARDING_STEPS.indexOf(screenName as any);
  }, []);

  const navigateToNextStep = useCallback(
    (currentScreen: string) => {
      const currentIndex = getCurrentStepIndex(currentScreen);
      if (currentIndex < ONBOARDING_STEPS.length - 1) {
        const nextScreen = ONBOARDING_STEPS[currentIndex + 1];
        navigation.navigate(nextScreen as any);

        // Update store with enum value
        const stepEnum = STEP_TO_ENUM[nextScreen];
        if (stepEnum) {
          setOnBoardingStep(stepEnum);
        }
      }
    },
    [navigation, getCurrentStepIndex, setOnBoardingStep],
  );

  const navigateToPreviousStep = useCallback(
    (currentScreen: string) => {
      const currentIndex = getCurrentStepIndex(currentScreen);
      if (currentIndex > 0) {
        const previousScreen = ONBOARDING_STEPS[currentIndex - 1];
        navigation.navigate(previousScreen as any);

        // Update store with enum value
        const stepEnum = STEP_TO_ENUM[previousScreen];
        if (stepEnum) {
          setOnBoardingStep(stepEnum);
        }
      }
    },
    [navigation, getCurrentStepIndex, setOnBoardingStep],
  );

  const skipToStep = useCallback(
    (stepName: string) => {
      if (ONBOARDING_STEPS.includes(stepName as any)) {
        navigation.navigate(stepName as any);

        // Update store with enum value
        const stepEnum = STEP_TO_ENUM[stepName];
        if (stepEnum) {
          setOnBoardingStep(stepEnum);
        }
      }
    },
    [navigation, setOnBoardingStep],
  );

  const completeOnboarding = useCallback(() => {
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
        onboardingCompletedAt: Date.now(),
      });
    }

    return true;
  }, [user, setOnboarded, setOnBoardingStep, setUserNavigationState]);

  // Helper to get progress percentage
  const getProgressPercentage = useCallback(() => {
    const currentStep =
      navigation.getState()?.routes[navigation.getState()?.index ?? 0]?.name;
    const currentIndex = ONBOARDING_STEPS.indexOf(currentStep as any);

    if (currentIndex === -1) return 0;
    return Math.round(((currentIndex + 1) / ONBOARDING_STEPS.length) * 100);
  }, [navigation]);

  return {
    steps: ONBOARDING_STEPS,
    navigateToNextStep,
    navigateToPreviousStep,
    skipToStep,
    completeOnboarding,
    getCurrentStepIndex,
    getProgressPercentage,
    setUserNavigationState,
    getUserNavigationState,
  };
}
