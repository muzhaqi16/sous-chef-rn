'use no memo';
import React from 'react';
import {
  render,
  screen,
  userEvent,
  within,
} from '@testing-library/react-native';
import { Text } from '#components/atoms/Text';
import { OnboardingStepScaffold } from '../OnboardingStepScaffold';
import { ONBOARDING_STEPS } from '#features/onboarding/screens/useOnboardingNavigation';
import { onboardingTestIDs } from '#features/onboarding/testIDs';
import { kitTestIDs } from '#components/testIDs';
import { useStore } from '#store';

let mockRouteName = 'Receipt';
jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ name: mockRouteName }),
}));

const NUMBERED = ONBOARDING_STEPS.filter(step => step.numbered).length;

describe('OnboardingStepScaffold', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteName = 'Receipt';
    useStore.setState({ selectedPantryId: 'pantry-1' });
  });

  it('renders children content', () => {
    render(
      <OnboardingStepScaffold>
        <Text>Content</Text>
      </OnboardingStepScaffold>,
    );
    expect(screen.getByText('Content')).toBeTruthy();
  });

  it('renders title when provided directly', () => {
    render(
      <OnboardingStepScaffold title="Welcome">
        <Text>Content</Text>
      </OnboardingStepScaffold>,
    );
    expect(screen.getByText('Welcome')).toBeTruthy();
  });

  it('shows the question in the content', () => {
    render(
      <OnboardingStepScaffold question="Get started">
        <Text>Content</Text>
      </OnboardingStepScaffold>,
    );
    expect(screen.getByText('Get started')).toBeTruthy();
  });

  it('renders back button when onBack is provided', async () => {
    const user = userEvent.setup();
    const onBack = jest.fn();
    render(
      <OnboardingStepScaffold onBack={onBack}>
        <Text>Content</Text>
      </OnboardingStepScaffold>,
    );
    await user.press(screen.getByTestId(kitTestIDs.headerBackButton));
    expect(onBack).toHaveBeenCalled();
  });

  it('does not render back button when onBack is not provided', () => {
    render(
      <OnboardingStepScaffold>
        <Text>Content</Text>
      </OnboardingStepScaffold>,
    );
    expect(screen.queryByTestId(kitTestIDs.headerBackButton)).toBeNull();
  });

  it('offers Skip in the header when onSkip is provided', async () => {
    const user = userEvent.setup();
    const onSkip = jest.fn();
    render(
      <OnboardingStepScaffold onSkip={onSkip}>
        <Text>Content</Text>
      </OnboardingStepScaffold>,
    );
    expect(screen.getByText('Skip')).toBeTruthy();
    await user.press(screen.getByText('Skip'));
    expect(onSkip).toHaveBeenCalled();
  });

  it("shows the route's place among the numbered steps, as text and on the bar", () => {
    // Household is the first question.
    mockRouteName = 'Household';
    render(
      <OnboardingStepScaffold>
        <Text>Content</Text>
      </OnboardingStepScaffold>,
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
        <OnboardingStepScaffold>
          <Text>Content</Text>
        </OnboardingStepScaffold>,
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

  it('puts the primary button in the footer above the step number, and Skip in the header', async () => {
    const user = userEvent.setup();
    const onNext = jest.fn();
    render(
      <OnboardingStepScaffold
        onSkip={jest.fn()}
        primary={{ label: 'Next', onPress: onNext, testID: 'primary' }}
      >
        <Text>Content</Text>
      </OnboardingStepScaffold>,
    );

    const footer = within(screen.getByTestId(onboardingTestIDs.footer));
    await user.press(footer.getByTestId('primary'));
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(footer.getByText('Next')).toBeTruthy();
    expect(
      footer.getByTestId(onboardingTestIDs.stepNumber, {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    expect(footer.queryByText('Skip')).toBeNull();
    expect(footer.queryByText('Content')).toBeNull();
  });

  it('shows skip button testID when testID and onSkip provided', () => {
    render(
      <OnboardingStepScaffold testID="onboarding" onSkip={jest.fn()}>
        <Text>Content</Text>
      </OnboardingStepScaffold>,
    );
    expect(screen.getByTestId('onboarding-skip-button')).toBeTruthy();
  });
});
