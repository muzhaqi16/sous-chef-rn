import React, { createContext, useContext, useState } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { useOnboardingNavigation } from '#features/onboarding/hooks/useOnboardingNavigation';
import type { OnboardingStep } from '#features/onboarding/components/OnboardingSteps/types';
import type { SharedValue } from 'react-native-reanimated';

// Split into Actions + State contexts so callback-only consumers don't re-render
// on a step change.

// `navigationSlice.onBoardingStep` (Zustand) is the PERSISTENT source of truth,
// surviving restarts so deep links can resume mid-onboarding; `activeStepIndex`
// and `currentIndex` here are session-only animation and UI derivations. Both
// update together via `useOnboardingNavigation` — change one, change the other.

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

type OnboardingContextType = OnboardingActionsContextType &
  OnboardingStateContextType;

const OnboardingActionsContext =
  createContext<OnboardingActionsContextType | null>(null);
const OnboardingStateContext = createContext<OnboardingStateContextType | null>(
  null,
);

interface OnboardingProviderProps {
  children: React.ReactNode;
  initialStepIndex?: number;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'CreateHome',
    titleKey: 'onboardingSteps.CreateHome.title',
    subtitleKey: 'onboardingSteps.CreateHome.subtitle',
  },
  {
    // Before CreateShoppingList and SelectPantryItems, both of which can record
    // a cost — and a cost keeps the currency it was recorded in.
    id: 'CurrencySetup',
    titleKey: 'labels.currency',
    subtitleKey: 'onboardingSteps.CurrencySetup.subtitle',
  },
  {
    id: 'CreateShoppingList',
    titleKey: 'labels.shoppingList',
    subtitleKey: 'onboardingSteps.CreateShoppingList.subtitle',
  },
  {
    id: 'SelectPantryItems',
    titleKey: 'onboardingSteps.SelectPantryItems.title',
    subtitleKey: 'onboardingSteps.SelectPantryItems.subtitle',
  },
  {
    id: 'ProfilePictureUpload',
    titleKey: 'labels.profilePicture',
    subtitleKey: 'onboardingSteps.ProfilePictureUpload.subtitle',
  },
  {
    id: 'InviteMembers',
    titleKey: 'labels.inviteMembers',
    subtitleKey: 'onboardingSteps.InviteMembers.subtitle',
  },
  {
    id: 'BiometricSetup',
    titleKey: 'labels.security',
    subtitleKey: 'onboardingSteps.BiometricSetup.subtitle',
  },
  {
    id: 'OnboardingComplete',
    titleKey: 'onboardingSteps.OnboardingComplete.title',
    subtitleKey: 'labels.youReAllSet',
  },
];

export const OnboardingProvider: React.FC<OnboardingProviderProps> = ({
  children,
  initialStepIndex = 0,
}) => {
  // The SharedValue drives the animated progress bar; the React state drives the
  // derivations below, which need re-renders.
  const activeStepIndex = useSharedValue(initialStepIndex);
  const [currentIndex, setCurrentIndex] = useState(initialStepIndex);
  const {
    navigateToNextStep,
    navigateToPreviousStep,
    skipToStep: navigationSkipToStep,
  } = useOnboardingNavigation();

  const currentStep = ONBOARDING_STEPS[currentIndex] || null;
  const isFirstStep = currentIndex <= 0;
  const isLastStep = currentIndex >= ONBOARDING_STEPS.length - 1;
  const canGoBack = !isFirstStep;
  const canGoNext = !isLastStep;

  const setIndex = (next: number) => {
    activeStepIndex.set(next);
    setCurrentIndex(next);
  };

  const goToNextStep = () => {
    if (canGoNext && currentStep) {
      setIndex(currentIndex + 1);
      navigateToNextStep(currentStep.id);
    }
  };

  const goToPreviousStep = () => {
    if (canGoBack && currentStep) {
      setIndex(currentIndex - 1);
      navigateToPreviousStep(currentStep.id);
    }
  };

  const goToStep = (stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex < ONBOARDING_STEPS.length) {
      setIndex(stepIndex);
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

export const useOnboardingActions = (): OnboardingActionsContextType => {
  const context = useContext(OnboardingActionsContext);
  if (!context) {
    throw new Error(
      'useOnboardingActions must be used within an OnboardingProvider',
    );
  }
  return context;
};

export const useOnboardingState = (): OnboardingStateContextType => {
  const context = useContext(OnboardingStateContext);
  if (!context) {
    throw new Error(
      'useOnboardingState must be used within an OnboardingProvider',
    );
  }
  return context;
};

/** Prefer `useOnboardingActions` or `useOnboardingState` — this subscribes to both. */
export const useOnboardingContext = (): OnboardingContextType => {
  const actions = useOnboardingActions();
  const state = useOnboardingState();
  return { ...actions, ...state };
};

export const useOnboardingContextSafe = (): OnboardingContextType | null => {
  const actions = useContext(OnboardingActionsContext);
  const state = useContext(OnboardingStateContext);
  if (!actions || !state) return null;
  return { ...actions, ...state };
};
