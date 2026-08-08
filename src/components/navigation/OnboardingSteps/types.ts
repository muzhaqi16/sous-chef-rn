import type { SharedValue } from 'react-native-reanimated';

export interface OnboardingStep {
  id: string;
  /**
   * i18n key paths, not display strings — ONBOARDING_STEPS is module-level and
   * cannot call a hook. OnBoardingWrapper resolves them.
   */
  titleKey: string;
  subtitleKey?: string;
  isCompleted?: boolean;
  isActive?: boolean;
}

export interface OnboardingStepsProps {
  steps: OnboardingStep[];
  activeIndex: SharedValue<number>;
  stepSize?: number;
  onStepPress?: (index: number) => void;
  allowStepNavigation?: boolean;
}

export interface StepDotProps {
  index: number;
  activeIndex: SharedValue<number>;
  stepSize: number;
  step: OnboardingStep;
  onPress?: (index: number) => void;
  allowNavigation?: boolean;
}
