import type { SharedValue } from 'react-native-reanimated';

export interface OnboardingStep {
  id: string;
  title: string;
  subtitle?: string;
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
