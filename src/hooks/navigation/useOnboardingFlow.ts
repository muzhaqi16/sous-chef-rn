import {useCallback} from 'react';
import {useStore} from '#store';
import {OnBoardingSteps} from '#store/slices/preferencesSlice';

export const useOnboardingFlow = () => {
  const {
    user,
    onBoardingStep,
    setOnBoardingStep,
    getUserNavigationState,
    setUserNavigationState,
  } = useStore();

  // Map steps to screen names
  const stepToScreen: Record<OnBoardingSteps, string> = {
    [OnBoardingSteps.createHome]: 'CreateHome',
    [OnBoardingSteps.createShoppingList]: 'CreateShoppingList',
    [OnBoardingSteps.selectPantryItems]: 'SelectPantryItems',
    [OnBoardingSteps.profilePictureUpload]: 'ProfilePictureUpload',
    [OnBoardingSteps.inviteMembers]: 'InviteMembers',
    [OnBoardingSteps.complete]: 'OnboardingComplete',
  };

  // Get current onboarding screen
  const getCurrentOnboardingScreen = useCallback((): string => {
    if (!user?.id) return 'CreateHome';

    const userState = getUserNavigationState(user.id);
    const currentStep = userState?.onboardingProgress || onBoardingStep;

    // Handle null onBoardingStep
    if (!currentStep) return 'CreateHome';

    return stepToScreen[currentStep as OnBoardingSteps] || 'CreateHome';
  }, [user?.id, getUserNavigationState, onBoardingStep]);

  // Progress to specific step
  const progressToStep = useCallback(
    (step: OnBoardingSteps): string => {
      if (!user?.id) {
        console.warn('Cannot progress onboarding without user');
        return 'CreateHome';
      }

      // Update both user-specific and global state
      setUserNavigationState(user.id, {
        onboardingProgress: step,
      });
      setOnBoardingStep(step);

      return stepToScreen[step];
    },
    [user?.id, setUserNavigationState, setOnBoardingStep],
  );

  // Move to next step in sequence
  const progressToNextStep = useCallback((): string | null => {
    const stepOrder = [
      OnBoardingSteps.createHome,
      OnBoardingSteps.createShoppingList,
      OnBoardingSteps.selectPantryItems,
      OnBoardingSteps.profilePictureUpload,
      OnBoardingSteps.inviteMembers,
      OnBoardingSteps.complete,
    ];

    // Handle null onBoardingStep - start from beginning
    const currentStep = onBoardingStep || OnBoardingSteps.createHome;
    const currentIndex = stepOrder.indexOf(currentStep);

    if (currentIndex === -1 || currentIndex >= stepOrder.length - 1) {
      return null; // Already at last step or invalid step
    }

    const nextStep = stepOrder[currentIndex + 1];
    return progressToStep(nextStep);
  }, [onBoardingStep, progressToStep]);

  // Skip to a specific step (simplified)
  const skipToStep = useCallback(
    (targetStep: OnBoardingSteps): string => {
      if (!user?.id) return 'CreateHome';

      setUserNavigationState(user.id, {
        onboardingProgress: targetStep,
      });
      setOnBoardingStep(targetStep);

      return stepToScreen[targetStep];
    },
    [user?.id, setUserNavigationState, setOnBoardingStep],
  );

  // Complete onboarding
  const completeOnboarding = useCallback((): boolean => {
    if (!user?.id) {
      console.warn('Cannot complete onboarding without user');
      return false;
    }

    setUserNavigationState(user.id, {
      onboardingProgress: OnBoardingSteps.complete,
      hasCompletedOnboarding: true,
    });
    setOnBoardingStep(OnBoardingSteps.complete);

    return true;
  }, [user?.id, setUserNavigationState, setOnBoardingStep]);

  // Check if a step is completed
  const isStepCompleted = useCallback(
    (step: OnBoardingSteps): boolean => {
      if (!user?.id) return false;

      const userState = getUserNavigationState(user.id);
      const currentStep = userState?.onboardingProgress || onBoardingStep;

      if (!currentStep) return false;

      const stepOrder = Object.values(OnBoardingSteps);
      const currentIndex = stepOrder.indexOf(currentStep as OnBoardingSteps);
      const checkIndex = stepOrder.indexOf(step);

      return checkIndex < currentIndex;
    },
    [user?.id, getUserNavigationState, onBoardingStep],
  );

  // Get onboarding progress percentage
  const getProgressPercentage = useCallback((): number => {
    if (!onBoardingStep) return 0;

    const stepOrder = Object.values(OnBoardingSteps);
    const currentIndex = stepOrder.indexOf(onBoardingStep);

    if (currentIndex === -1) return 0;
    if (onBoardingStep === OnBoardingSteps.complete) return 100;

    return Math.round((currentIndex / (stepOrder.length - 1)) * 100);
  }, [onBoardingStep]);

  // Reset onboarding (for testing/development)
  const resetOnboarding = useCallback(() => {
    if (!user?.id) return;

    setUserNavigationState(user.id, {
      onboardingProgress: OnBoardingSteps.createHome,
      hasCompletedOnboarding: false,
    });
    setOnBoardingStep(OnBoardingSteps.createHome);
  }, [user?.id, setUserNavigationState, setOnBoardingStep]);

  // Get current step with fallback
  const getCurrentStep = useCallback((): OnBoardingSteps => {
    return onBoardingStep || OnBoardingSteps.createHome;
  }, [onBoardingStep]);

  return {
    // Current state
    currentStep: getCurrentStep(),
    currentScreen: getCurrentOnboardingScreen(),
    progressPercentage: getProgressPercentage(),

    // Navigation
    getCurrentOnboardingScreen,
    progressToStep,
    progressToNextStep,
    skipToStep,

    // Completion
    completeOnboarding,
    isStepCompleted,

    // Development
    resetOnboarding,
  };
};
