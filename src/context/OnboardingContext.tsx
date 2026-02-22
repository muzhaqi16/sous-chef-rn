import React, { createContext, useContext, useMemo, useCallback } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { useOnboardingNavigation } from '#hooks/navigation/useOnboardingNavigation';
import type { OnboardingStep } from '#components/navigation/OnboardingSteps/types';
import type { SharedValue } from 'react-native-reanimated';

interface OnboardingContextType {
  // Step management
  steps: OnboardingStep[];
  activeStepIndex: SharedValue<number>;
  currentStep: OnboardingStep | null;

  // Navigation methods
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  goToStep: (stepIndex: number) => void;
  skipToStep: (stepName: string) => void;
  canGoBack: boolean;
  canGoNext: boolean;
  isFirstStep: boolean;
  isLastStep: boolean;

  // Step utilities
  getStepByIndex: (index: number) => OnboardingStep | null;
  getStepProgress: () => number;
}

const OnboardingContext = createContext<OnboardingContextType | null>(null);

interface OnboardingProviderProps {
  children: React.ReactNode;
  initialStepIndex?: number;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'CreateHome',
    title: 'Create Home',
    subtitle: 'Set up your household',
  },
  {
    id: 'CreateShoppingList',
    title: 'Shopping List',
    subtitle: 'Create your first list',
  },
  {
    id: 'SelectPantryItems',
    title: 'Pantry Items',
    subtitle: 'Select what you have',
  },
  {
    id: 'ProfilePictureUpload',
    title: 'Profile Picture',
    subtitle: 'Add your photo',
  },
  {
    id: 'InviteMembers',
    title: 'Invite Members',
    subtitle: 'Share with family',
  },
  {
    id: 'BiometricSetup',
    title: 'Security',
    subtitle: 'Set up biometrics',
  },
  {
    id: 'OnboardingComplete',
    title: 'Complete',
    subtitle: 'You\'re all set!',
  },
];

export const OnboardingProvider: React.FC<OnboardingProviderProps> = ({
  children,
  initialStepIndex = 0,
}) => {
  const activeStepIndex = useSharedValue(initialStepIndex);
  const {
    navigateToNextStep,
    navigateToPreviousStep,
    skipToStep: navigationSkipToStep,
  } = useOnboardingNavigation();

  // Current step calculation
  const currentStep = useMemo(() => {
    const index = Math.floor(activeStepIndex.get());
    return ONBOARDING_STEPS[index] || null;
  }, [activeStepIndex.get()]);

  // Navigation state
  const isFirstStep = useMemo(() => activeStepIndex.get() <= 0, [activeStepIndex.get()]);
  const isLastStep = useMemo(() => activeStepIndex.get() >= ONBOARDING_STEPS.length - 1, [activeStepIndex.get()]);
  const canGoBack = useMemo(() => !isFirstStep, [isFirstStep]);
  const canGoNext = useMemo(() => !isLastStep, [isLastStep]);

  // Navigation methods
  const goToNextStep = useCallback(() => {
    if (canGoNext && currentStep) {
      const nextIndex = activeStepIndex.get() + 1;
      activeStepIndex.set(nextIndex);
      navigateToNextStep(currentStep.id);
    }
  }, [canGoNext, currentStep, activeStepIndex, navigateToNextStep]);

  const goToPreviousStep = useCallback(() => {
    if (canGoBack && currentStep) {
      const prevIndex = activeStepIndex.get() - 1;
      activeStepIndex.set(prevIndex);
      navigateToPreviousStep(currentStep.id);
    }
  }, [canGoBack, currentStep, activeStepIndex, navigateToPreviousStep]);

  const goToStep = useCallback((stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex < ONBOARDING_STEPS.length) {
      activeStepIndex.set(stepIndex);
      const targetStep = ONBOARDING_STEPS[stepIndex];
      if (targetStep) {
        navigationSkipToStep(targetStep.id);
      }
    }
  }, [activeStepIndex, navigationSkipToStep]);

  const skipToStep = useCallback((stepName: string) => {
    const stepIndex = ONBOARDING_STEPS.findIndex(step => step.id === stepName);
    if (stepIndex !== -1) {
      goToStep(stepIndex);
    }
  }, [goToStep]);

  // Utility methods
  const getStepByIndex = useCallback((index: number): OnboardingStep | null => {
    return ONBOARDING_STEPS[index] || null;
  }, []);

  const getStepProgress = useCallback(() => {
    return Math.round(((activeStepIndex.get() + 1) / ONBOARDING_STEPS.length) * 100);
  }, [activeStepIndex.get()]);

  const contextValue: OnboardingContextType = useMemo(() => ({
    steps: ONBOARDING_STEPS,
    activeStepIndex,
    currentStep,
    goToNextStep,
    goToPreviousStep,
    goToStep,
    skipToStep,
    canGoBack,
    canGoNext,
    isFirstStep,
    isLastStep,
    getStepByIndex,
    getStepProgress,
  }), [
    activeStepIndex,
    currentStep,
    goToNextStep,
    goToPreviousStep,
    goToStep,
    skipToStep,
    canGoBack,
    canGoNext,
    isFirstStep,
    isLastStep,
    getStepByIndex,
    getStepProgress,
  ]);

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboardingContext = (): OnboardingContextType => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboardingContext must be used within an OnboardingProvider');
  }
  return context;
};

// Safe version that returns null instead of throwing
export const useOnboardingContextSafe = (): OnboardingContextType | null => {
  const context = useContext(OnboardingContext);
  return context;
};