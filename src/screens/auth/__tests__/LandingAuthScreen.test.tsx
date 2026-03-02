import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { LandingAuthScreen } from '../LandingAuthScreen';

const mockNavigate = jest.fn();

jest.mock('#hooks/navigation/useSafeNavigation', () => ({
  useSafeNavigation: () => ({
    navigation: { navigate: mockNavigate },
    canGoBack: true,
    goBack: jest.fn(),
  }),
}));

jest.mock('#components/templates/AuthWrapper', () => {
  const { View } = require('react-native');
  return {
    AuthWrapper: ({ children, testID }: any) => (
      <View testID={testID}>{children}</View>
    ),
  };
});

jest.mock('#components/base/Button', () => {
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({ title, onPress, testID }: any) => (
      <Pressable onPress={onPress} testID={testID} accessibilityRole="button">
        <Text>{title}</Text>
      </Pressable>
    ),
  };
});

jest.mock('#utils/environment', () => ({
  getWebAppUrl: (path: string) => `https://app.example.com${path}`,
}));

describe('LandingAuthScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the screen with testID', () => {
    render(<LandingAuthScreen />);
    expect(screen.getByTestId('landing-auth-screen')).toBeTruthy();
  });

  it('renders the tagline title', () => {
    render(<LandingAuthScreen />);
    expect(screen.getByText('End Waste, Save Time & Money')).toBeTruthy();
  });

  it('renders the subtitle description', () => {
    render(<LandingAuthScreen />);
    expect(
      screen.getByText(
        "Know what you have, plan what's next, and shop smarter every time.",
      ),
    ).toBeTruthy();
  });

  it('renders Log In button', () => {
    render(<LandingAuthScreen />);
    expect(screen.getByTestId('landing-login-button')).toBeTruthy();
    expect(screen.getByText('Log In')).toBeTruthy();
  });

  it('renders Sign Up button', () => {
    render(<LandingAuthScreen />);
    expect(screen.getByTestId('landing-signup-button')).toBeTruthy();
    expect(screen.getByText('Sign Up')).toBeTruthy();
  });

  it('navigates to Login when Log In button is pressed', () => {
    render(<LandingAuthScreen />);
    fireEvent.press(screen.getByTestId('landing-login-button'));
    expect(mockNavigate).toHaveBeenCalledWith('Login');
  });

  it('navigates to SignUp when Sign Up button is pressed', () => {
    render(<LandingAuthScreen />);
    fireEvent.press(screen.getByTestId('landing-signup-button'));
    expect(mockNavigate).toHaveBeenCalledWith('SignUp');
  });

  it('renders the footer legal text', () => {
    render(<LandingAuthScreen />);
    expect(screen.getByText(/Terms & Conditions/)).toBeTruthy();
    expect(screen.getByText(/Privacy Policy/)).toBeTruthy();
  });
});
