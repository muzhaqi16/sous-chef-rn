'use no memo';
import React from 'react';
import {
  render,
  screen,
  userEvent,
  within,
} from '@testing-library/react-native';
import { Text } from '#components/atoms/Text';
import { OnBoardingWrapper } from '../OnBoardingWrapper';
import { ONBOARDING_STEPS } from '#features/onboarding/screens/useOnboardingNavigation';
import { onboardingTestIDs } from '#features/onboarding/testIDs';
import { kitTestIDs } from '#components/testIDs';
import { useStore } from '#store';

let mockRouteName = 'Receipt';
jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ name: mockRouteName }),
}));

const NUMBERED = ONBOARDING_STEPS.filter(step => step.numbered).length;

describe('OnBoardingWrapper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteName = 'Receipt';
    useStore.setState({ selectedPantryId: 'pantry-1' });
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
    await user.press(screen.getByTestId(kitTestIDs.headerBackButton));
    expect(onBack).toHaveBeenCalled();
  });

  it('does not render back button when onBack is not provided', () => {
    render(
      <OnBoardingWrapper>
        <Text>Content</Text>
      </OnBoardingWrapper>,
    );
    expect(screen.queryByTestId(kitTestIDs.headerBackButton)).toBeNull();
  });

  it('renders skip button when onSkip is provided', async () => {
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

  it("shows the route's place among the numbered steps, as text and on the bar", () => {
    // Household is the first question.
    mockRouteName = 'Household';
    render(
      <OnBoardingWrapper>
        <Text>Content</Text>
      </OnBoardingWrapper>,
    );

    // The numbers come from ONBOARDING_STEPS, so removing a step moves them
    // without any screen being edited. The text is hidden from a screen reader,
    // which reads the bar's label instead.
    expect(
      screen.getByTestId(onboardingTestIDs.stepNumber, {
        includeHiddenElements: true,
      }),
    ).toHaveTextContent(`Step 1 of ${NUMBERED}`);
    expect(screen.getByLabelText(`Step 1 of ${NUMBERED}`)).toBeTruthy();
  });

  it('numbers neither the completion screen nor a screen outside the flow', () => {
    for (const route of ['OnboardingComplete', 'SomewhereElse']) {
      mockRouteName = route;
      const { unmount } = render(
        <OnBoardingWrapper>
          <Text>Content</Text>
        </OnBoardingWrapper>,
      );
      expect(
        screen.queryByTestId(onboardingTestIDs.stepNumber, {
          includeHiddenElements: true,
        }),
      ).toBeNull();
      expect(screen.queryByLabelText(/^Step /)).toBeNull();
      unmount();
    }
  });

  it('puts the primary action in the footer, above the step number and Skip', () => {
    render(
      <OnBoardingWrapper
        onSkip={jest.fn()}
        primaryAction={<Text testID="primary">Next</Text>}
      >
        <Text>Content</Text>
      </OnBoardingWrapper>,
    );

    const footer = within(screen.getByTestId(onboardingTestIDs.footer));
    expect(footer.getByTestId('primary')).toBeTruthy();
    expect(footer.getByText('Skip')).toBeTruthy();
    expect(
      footer.getByTestId(onboardingTestIDs.stepNumber, {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    expect(footer.queryByText('Content')).toBeNull();
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
