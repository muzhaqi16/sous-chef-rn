'use no memo';

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { OnboardingCompleteScreen } from '../OnboardingCompleteScreen';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#store/useAppStore', () => {
  const fn = (selector: any) => selector({
    user: { id: 'u1', onBoarded: false },
    updateUser: jest.fn(),
  });
  fn.getState = () => ({});
  fn.setState = jest.fn();
  fn.subscribe = jest.fn();
  return { useAppStore: fn };
});

const mockCompleteOnboarding = jest.fn(() => Promise.resolve({ data: {} }));
jest.mock('#generated', () => ({
  ...jest.requireActual('#generated'),
  useCompleteOnboardingMutation: jest.fn(() => [mockCompleteOnboarding, { loading: false }]),
}));

jest.mock('#hooks/performance/useScreenTransition');

jest.mock('#components/templates/OnBoardingWrapper', () => ({
  OnBoardingWrapper: ({ title, subtitle, children, testID }: any) => {
    const { View, Text } = require('react-native');
    return (
      <View testID={testID || 'onboarding-wrapper'}>
        <Text>{title}</Text>
        <Text>{subtitle}</Text>
        {children}
      </View>
    );
  },
}));
jest.mock('#components/base/Button', () => ({
  Button: ({ title, onPress, disabled }: any) => {
    const { Pressable, Text } = require('react-native');
    return <Pressable onPress={onPress} disabled={disabled} testID="complete-button"><Text>{title}</Text></Pressable>;
  },
}));

describe('OnboardingCompleteScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders all set title', () => {
    render(<OnboardingCompleteScreen />);
    expect(screen.getByText('All set!')).toBeTruthy();
  });

  it('renders subtitle', () => {
    render(<OnboardingCompleteScreen />);
    expect(screen.getByText('Your home is ready to use')).toBeTruthy();
  });

  it('renders congratulations text', () => {
    render(<OnboardingCompleteScreen />);
    expect(screen.getByText("Congratulations! You've successfully set up:")).toBeTruthy();
  });

  it('renders summary items', () => {
    render(<OnboardingCompleteScreen />);
    expect(screen.getByText(/Your home and pantry/)).toBeTruthy();
    expect(screen.getByText(/Your shopping list/)).toBeTruthy();
    expect(screen.getByText(/Initial pantry items/)).toBeTruthy();
    expect(screen.getByText(/Invited family/)).toBeTruthy();
  });

  it('renders the Get Started button', () => {
    render(<OnboardingCompleteScreen />);
    expect(screen.getByText('Get Started')).toBeTruthy();
  });

  it('calls mutation on button press', () => {
    render(<OnboardingCompleteScreen />);
    fireEvent.press(screen.getByTestId('complete-button'));
    expect(mockCompleteOnboarding).toHaveBeenCalled();
  });

  it('renders testID', () => {
    render(<OnboardingCompleteScreen />);
    expect(screen.getByTestId('onboarding-complete-screen')).toBeTruthy();
  });
});
