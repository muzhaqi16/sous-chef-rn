'use no memo';
import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { Text } from '#components/atoms/Text';
import { OnBoardingWrapper } from '../OnBoardingWrapper';
import { ONBOARDING_STEPS } from '#features/onboarding/hooks/useOnboardingNavigation';
import { kitTestIDs } from '#components/testIDs';

let mockRouteName = 'CreateHome';
jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ name: mockRouteName }),
}));

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');
describe('OnBoardingWrapper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  it('reports the position of the route it is rendering, out of the flow length', () => {
    mockRouteName = 'CreateShoppingList';
    render(
      <OnBoardingWrapper>
        <Text>Content</Text>
      </OnBoardingWrapper>,
    );

    // Second of seven: the numbers come from ONBOARDING_STEPS, so removing a
    // step moves them without any screen being edited.
    expect(
      screen.getByLabelText(`Step 2 of ${ONBOARDING_STEPS.length}`),
    ).toBeTruthy();
  });

  it('reports no progress on a screen the flow does not contain', () => {
    mockRouteName = 'SomewhereElse';
    const { toJSON } = render(
      <OnBoardingWrapper>
        <Text>Content</Text>
      </OnBoardingWrapper>,
    );
    expect(toJSON()).toBeTruthy();
    expect(screen.queryByLabelText(/^Step /)).toBeNull();
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
