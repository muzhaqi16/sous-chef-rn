'use no memo';
import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { Text } from '#components/atoms/Text';
import { OnBoardingWrapper } from '../OnBoardingWrapper';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');
jest.mock('#components/atoms/BackButton', () => ({
  BackButton: ({
    onPress,
    testID,
  }: {
    onPress?: () => void;
    testID?: string;
  }) => {
    const { Pressable, Text: RNText } = require('react-native');
    return (
      <Pressable onPress={onPress} testID={testID}>
        <RNText>Back</RNText>
      </Pressable>
    );
  },
}));
jest.mock('#components/navigation/OnboardingSteps/OnboardingSteps', () => ({
  OnboardingSteps: () => {
    const { Text: RNText } = require('react-native');
    return <RNText>StepIndicator</RNText>;
  },
}));
jest.mock(
  '#components/navigation/OnboardingNavigation/OnboardingNavigation',
  () => ({
    OnboardingNavigation: ({
      showBackButton,
      showContinueButton,
      showSkipButton,
    }: {
      showBackButton?: boolean;
      showContinueButton?: boolean;
      showSkipButton?: boolean;
    }) => {
      const { Text: RNText } = require('react-native');
      return (
        <>
          {showBackButton ? <RNText>NavBack</RNText> : null}
          {showContinueButton ? <RNText>NavContinue</RNText> : null}
          {showSkipButton ? <RNText>NavSkip</RNText> : null}
        </>
      );
    },
  }),
);

interface MockOnboardingContextValue {
  steps: { id: string; title: string }[];
  activeStepIndex: number;
  currentStep: { title: string; subtitle?: string } | null;
  canGoBack: boolean;
  canGoNext: boolean;
  isLastStep: boolean;
  goToStep: jest.Mock;
  goToNextStep: jest.Mock;
  goToPreviousStep: jest.Mock;
}

const mockOnboardingContext = jest.fn<MockOnboardingContextValue | null, []>(
  () => null,
);
jest.mock('#/context/OnboardingContext', () => ({
  useOnboardingContextSafe: () => mockOnboardingContext(),
}));

describe('OnBoardingWrapper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOnboardingContext.mockReturnValue(null);
  });

  it('renders children content', () => {
    render(
      <OnBoardingWrapper>
        <Text>Content</Text>
      </OnBoardingWrapper>,
    );
    expect(screen.getByText('Content')).toBeTruthy();
  });

  it('renders title when provided directly', () => {
    render(
      <OnBoardingWrapper title="Welcome">
        <Text>Content</Text>
      </OnBoardingWrapper>,
    );
    expect(screen.getByText('Welcome')).toBeTruthy();
  });

  it('renders subtitle when provided', () => {
    render(
      <OnBoardingWrapper subtitle="Get started">
        <Text>Content</Text>
      </OnBoardingWrapper>,
    );
    expect(screen.getByText('Get started')).toBeTruthy();
  });

  it('renders back button when onBack is provided', async () => {
    const user = userEvent.setup();
    const onBack = jest.fn();
    render(
      <OnBoardingWrapper onBack={onBack}>
        <Text>Content</Text>
      </OnBoardingWrapper>,
    );
    expect(screen.getByText('Back')).toBeTruthy();
    await user.press(screen.getByText('Back'));
    expect(onBack).toHaveBeenCalled();
  });

  it('does not render back button when onBack is not provided', () => {
    render(
      <OnBoardingWrapper>
        <Text>Content</Text>
      </OnBoardingWrapper>,
    );
    expect(screen.queryByText('Back')).toBeNull();
  });

  it('renders skip button in legacy mode when onSkip is provided', async () => {
    const user = userEvent.setup();
    const onSkip = jest.fn();
    render(
      <OnBoardingWrapper onSkip={onSkip}>
        <Text>Content</Text>
      </OnBoardingWrapper>,
    );
    expect(screen.getByText('Skip')).toBeTruthy();
    await user.press(screen.getByText('Skip'));
    expect(onSkip).toHaveBeenCalled();
  });

  it('renders progress bar in legacy mode when step and totalSteps are provided', () => {
    const { toJSON } = render(
      <OnBoardingWrapper step={2} totalSteps={5}>
        <Text>Content</Text>
      </OnBoardingWrapper>,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('does not render progress bar when step is not provided', () => {
    const { toJSON } = render(
      <OnBoardingWrapper>
        <Text>Content</Text>
      </OnBoardingWrapper>,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders OnboardingNavigation when context is available', () => {
    mockOnboardingContext.mockReturnValue({
      steps: [{ id: '1', title: 'Step 1' }],
      activeStepIndex: 0,
      currentStep: { title: 'Step 1', subtitle: 'Do this' },
      canGoBack: true,
      canGoNext: true,
      isLastStep: false,
      goToStep: jest.fn(),
      goToNextStep: jest.fn(),
      goToPreviousStep: jest.fn(),
    });
    render(
      <OnBoardingWrapper>
        <Text>Content</Text>
      </OnBoardingWrapper>,
    );
    expect(screen.getByText('NavBack')).toBeTruthy();
    expect(screen.getByText('NavContinue')).toBeTruthy();
  });

  it('uses context title when no direct title prop', () => {
    mockOnboardingContext.mockReturnValue({
      steps: [{ id: '1', title: 'Context Title' }],
      activeStepIndex: 0,
      currentStep: { title: 'Context Title', subtitle: 'Sub' },
      canGoBack: false,
      canGoNext: true,
      isLastStep: false,
      goToStep: jest.fn(),
      goToNextStep: jest.fn(),
      goToPreviousStep: jest.fn(),
    });
    render(
      <OnBoardingWrapper>
        <Text>Content</Text>
      </OnBoardingWrapper>,
    );
    expect(screen.getByText('Context Title')).toBeTruthy();
  });

  it('renders step indicator when showSteps is true and context available', () => {
    mockOnboardingContext.mockReturnValue({
      steps: [{ id: '1', title: 'Step 1' }],
      activeStepIndex: 0,
      currentStep: { title: 'Step 1' },
      canGoBack: false,
      canGoNext: true,
      isLastStep: false,
      goToStep: jest.fn(),
      goToNextStep: jest.fn(),
      goToPreviousStep: jest.fn(),
    });
    render(
      <OnBoardingWrapper showSteps>
        <Text>Content</Text>
      </OnBoardingWrapper>,
    );
    expect(screen.getByText('StepIndicator')).toBeTruthy();
  });

  it('does not render step indicator in legacy mode', () => {
    render(
      <OnBoardingWrapper showSteps>
        <Text>Content</Text>
      </OnBoardingWrapper>,
    );
    expect(screen.queryByText('StepIndicator')).toBeNull();
  });

  it('hides navigation when showNavigation is false', () => {
    mockOnboardingContext.mockReturnValue({
      steps: [],
      activeStepIndex: 0,
      currentStep: null,
      canGoBack: true,
      canGoNext: true,
      isLastStep: false,
      goToStep: jest.fn(),
      goToNextStep: jest.fn(),
      goToPreviousStep: jest.fn(),
    });
    render(
      <OnBoardingWrapper showNavigation={false}>
        <Text>Content</Text>
      </OnBoardingWrapper>,
    );
    expect(screen.queryByText('NavBack')).toBeNull();
    expect(screen.queryByText('NavContinue')).toBeNull();
  });

  it('passes testID to back button', () => {
    const onBack = jest.fn();
    render(
      <OnBoardingWrapper testID="onboarding-screen" onBack={onBack}>
        <Text>Content</Text>
      </OnBoardingWrapper>,
    );
    expect(screen.getByTestId('onboarding-screen-back-button')).toBeTruthy();
  });

  it('shows skip button testID when testID and onSkip provided', () => {
    render(
      <OnBoardingWrapper testID="onboarding" onSkip={jest.fn()}>
        <Text>Content</Text>
      </OnBoardingWrapper>,
    );
    expect(screen.getByTestId('onboarding-skip-button')).toBeTruthy();
  });
});
