import React, { createContext, useContext } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { useOnboardingNavigation } from '#hooks/navigation/useOnboardingNavigation';
import type { OnboardingStep } from '#components/navigation/OnboardingSteps/types';
import type { SharedValue } from 'react-native-reanimated';

/**
 * Split into Actions + State contexts (TabBarActionsContext pattern).
 * Consumers that only need callbacks (goToNextStep, etc.) subscribe to
 * OnboardingActionsContext and won't re-render when step index changes.
 */

interface OnboardingActionsContextType {
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  goToStep: (stepIndex: number) => void;
  skipToStep: (stepName: string) => void;
  getStepByIndex: (index: number) => OnboardingStep | null;
  getStepProgress: () => number;
}

interface OnboardingStateContextType {
  steps: OnboardingStep[];
  activeStepIndex: SharedValue<number>;
  currentStep: OnboardingStep | null;
  canGoBack: boolean;
  canGoNext: boolean;
  isFirstStep: boolean;
  isLastStep: boolean;
}

// Combined type for backwards compatibility
type OnboardingContextType = OnboardingActionsContextType & OnboardingStateContextType;

const OnboardingActionsContext = createContext<OnboardingActionsContextType | null>(null);
const OnboardingStateContext = createContext<OnboardingStateContextType | null>(null);

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
  const currentIndex = activeStepIndex.get();
  const {
    navigateToNextStep,
    navigateToPreviousStep,
    skipToStep: navigationSkipToStep,
  } = useOnboardingNavigation();

  // Current step calculation
  const currentStepIndex = Math.floor(currentIndex);
  const currentStep = ONBOARDING_STEPS[currentStepIndex] || null;

  // Navigation state
  const isFirstStep = currentIndex <= 0;
  const isLastStep = currentIndex >= ONBOARDING_STEPS.length - 1;
  const canGoBack = !isFirstStep;
  const canGoNext = !isLastStep;

  // Navigation methods
  const goToNextStep = () => {
    if (canGoNext && currentStep) {
      const nextIndex = activeStepIndex.get() + 1;
      activeStepIndex.set(nextIndex);
      navigateToNextStep(currentStep.id);
    }
  };

  const goToPreviousStep = () => {
    if (canGoBack && currentStep) {
      const prevIndex = activeStepIndex.get() - 1;
      activeStepIndex.set(prevIndex);
      navigateToPreviousStep(currentStep.id);
    }
  };

  const goToStep = (stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex < ONBOARDING_STEPS.length) {
      activeStepIndex.set(stepIndex);
      const targetStep = ONBOARDING_STEPS[stepIndex];
      if (targetStep) {
        navigationSkipToStep(targetStep.id);
      }
    }
  };

  const skipToStep = (stepName: string) => {
    const stepIndex = ONBOARDING_STEPS.findIndex(step => step.id === stepName);
    if (stepIndex !== -1) {
      goToStep(stepIndex);
    }
  };

  // Utility methods
  const getStepByIndex = (index: number): OnboardingStep | null => {
    return ONBOARDING_STEPS[index] || null;
  };

  const getStepProgress = () => {
    return Math.round(((currentIndex + 1) / ONBOARDING_STEPS.length) * 100);
  };

  const actionsValue: OnboardingActionsContextType = {
    goToNextStep,
    goToPreviousStep,
    goToStep,
    skipToStep,
    getStepByIndex,
    getStepProgress,
  };

  const stateValue: OnboardingStateContextType = {
    steps: ONBOARDING_STEPS,
    activeStepIndex,
    currentStep,
    canGoBack,
    canGoNext,
    isFirstStep,
    isLastStep,
  };

  return (
    <OnboardingActionsContext.Provider value={actionsValue}>
      <OnboardingStateContext.Provider value={stateValue}>
        {children}
      </OnboardingStateContext.Provider>
    </OnboardingActionsContext.Provider>
  );
};

/**
 * Hook to access only onboarding action callbacks.
 * Consumers won't re-render when step state changes.
 */
export const useOnboardingActions = (): OnboardingActionsContextType => {
  const context = useContext(OnboardingActionsContext);
  if (!context) {
    throw new Error('useOnboardingActions must be used within an OnboardingProvider');
  }
  return context;
};

/**
 * Hook to access onboarding step state (currentStep, canGoBack, etc.).
 * Re-renders when step state changes.
 */
export const useOnboardingState = (): OnboardingStateContextType => {
  const context = useContext(OnboardingStateContext);
  if (!context) {
    throw new Error('useOnboardingState must be used within an OnboardingProvider');
  }
  return context;
};

/**
 * Combined hook — backwards compatible.
 * Prefer useOnboardingActions or useOnboardingState for better performance.
 */
export const useOnboardingContext = (): OnboardingContextType => {
  const actions = useOnboardingActions();
  const state = useOnboardingState();
  return { ...actions, ...state };
};

// Safe version that returns null instead of throwing
export const useOnboardingContextSafe = (): OnboardingContextType | null => {
  const actions = useContext(OnboardingActionsContext);
  const state = useContext(OnboardingStateContext);
  if (!actions || !state) return null;
  return { ...actions, ...state };
};
