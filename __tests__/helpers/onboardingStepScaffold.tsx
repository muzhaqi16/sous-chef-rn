import React from 'react';
import { View } from 'react-native';
import { Text } from '#components/atoms/Text';
import { Pressable } from '#components/atoms/themedComponents';
import type { StepPrimary } from '#features/onboarding/components/OnboardingStepScaffold';

/** The primary button's testID when the step gives it none. */
export const STEP_PRIMARY = 'step-primary';

/**
 * `OnboardingStepScaffold` without its Screen: the title, the question, the
 * primary button by its label, Skip and the step's content, so a step's test
 * presses them as a user would. Use as the module's mock:
 * `jest.mock('#features/onboarding/components/OnboardingStepScaffold', () => require('#/test-utils/onboardingStepScaffold'))`.
 */
export const OnboardingStepScaffold = ({
  children,
  title,
  question,
  onSkip,
  primary,
  testID,
}: {
  children?: React.ReactNode;
  title?: string;
  question?: string;
  onSkip?: () => void;
  primary?: StepPrimary;
  testID?: string;
}) => (
  <View testID={testID}>
    {title ? <Text role="body">{title}</Text> : null}
    {question ? <Text role="body">{question}</Text> : null}
    {children}
    {primary ? (
      <Pressable
        onPress={primary.onPress}
        disabled={primary.disabled || primary.loading}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!primary.disabled }}
        testID={primary.testID ?? STEP_PRIMARY}
      >
        <Text role="body">{primary.label}</Text>
      </Pressable>
    ) : null}
    {onSkip ? (
      <Pressable onPress={onSkip}>
        <Text role="body">Skip</Text>
      </Pressable>
    ) : null}
  </View>
);
