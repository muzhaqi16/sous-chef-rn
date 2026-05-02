import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { OnboardingNavigation } from '../OnboardingNavigation/OnboardingNavigation';
import { NavigationButton } from '../OnboardingNavigation/NavigationButton';

jest.mock('#constants/animations', () => ({
  TIMING: { FAST: 100, MODERATE: 200, STANDARD: 300, SLOW: 400 },
}));

describe('NavigationButton', () => {
  const defaultAction = {
    label: 'Continue',
    onPress: jest.fn(),
    backgroundColor: '#007AFF',
  };

  it('renders with the provided label', () => {
    render(<NavigationButton action={defaultAction} />);
    expect(screen.getByText('Continue')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    render(<NavigationButton action={{ ...defaultAction, onPress }} />);
    fireEvent.press(screen.getByText('Continue'));
    expect(onPress).toHaveBeenCalled();
  });

  it('renders icon when iconVisible is true and icon is provided', () => {
    const R = require('react');
    const RN = require('react-native');
    const icon = R.createElement(RN.Text, { testID: 'nav-icon' }, 'Icon');
    render(
      <NavigationButton
        action={{ ...defaultAction, icon, iconVisible: true }}
      />,
    );
    expect(screen.getByTestId('nav-icon')).toBeTruthy();
  });

  it('does not render icon when iconVisible is false', () => {
    const R = require('react');
    const RN = require('react-native');
    const icon = R.createElement(RN.Text, { testID: 'nav-icon' }, 'Icon');
    render(
      <NavigationButton
        action={{ ...defaultAction, icon, iconVisible: false }}
      />,
    );
    expect(screen.queryByTestId('nav-icon')).toBeNull();
  });
});

describe('OnboardingNavigation', () => {
  const continueAction = {
    label: 'Next',
    onPress: jest.fn(),
    backgroundColor: '#007AFF',
  };
  const backAction = {
    label: 'Back',
    onPress: jest.fn(),
    backgroundColor: '#EEE',
  };
  const skipAction = {
    label: 'Skip',
    onPress: jest.fn(),
    backgroundColor: 'transparent',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders continue button', () => {
    render(
      <OnboardingNavigation
        showBackButton={false}
        showContinueButton={true}
        continueAction={continueAction}
      />,
    );
    expect(screen.getByText('Next')).toBeTruthy();
  });

  it('renders back button when showBackButton is true', () => {
    render(
      <OnboardingNavigation
        showBackButton={true}
        showContinueButton={true}
        backAction={backAction}
        continueAction={continueAction}
      />,
    );
    expect(screen.getByText('Back')).toBeTruthy();
  });

  it('does not render back button when showBackButton is false', () => {
    render(
      <OnboardingNavigation
        showBackButton={false}
        showContinueButton={true}
        continueAction={continueAction}
      />,
    );
    expect(screen.queryByText('Back')).toBeNull();
  });

  it('renders skip button when showSkipButton is true', () => {
    render(
      <OnboardingNavigation
        showBackButton={false}
        showContinueButton={true}
        showSkipButton={true}
        continueAction={continueAction}
        skipAction={skipAction}
      />,
    );
    expect(screen.getByText('Skip')).toBeTruthy();
  });

  it('does not render skip button by default', () => {
    render(
      <OnboardingNavigation
        showBackButton={false}
        showContinueButton={true}
        continueAction={continueAction}
      />,
    );
    expect(screen.queryByText('Skip')).toBeNull();
  });

  it('shows Finish label on last step', () => {
    render(
      <OnboardingNavigation
        showBackButton={false}
        showContinueButton={true}
        continueAction={continueAction}
        isLastStep={true}
      />,
    );
    expect(screen.getByText('Finish')).toBeTruthy();
    expect(screen.queryByText('Next')).toBeNull();
  });

  it('calls continueAction.onPress when continue is pressed', () => {
    render(
      <OnboardingNavigation
        showBackButton={false}
        showContinueButton={true}
        continueAction={continueAction}
      />,
    );
    fireEvent.press(screen.getByText('Next'));
    expect(continueAction.onPress).toHaveBeenCalled();
  });

  it('does not render continue button when showContinueButton is false', () => {
    render(
      <OnboardingNavigation
        showBackButton={true}
        showContinueButton={false}
        backAction={backAction}
        continueAction={continueAction}
      />,
    );
    expect(screen.queryByText('Next')).toBeNull();
  });
});
