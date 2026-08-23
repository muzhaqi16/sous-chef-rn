import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { LandingAuthScreen } from '../LandingAuthScreen';

const mockToLogin = jest.fn();
const mockToSignUp = jest.fn();

jest.mock('#hooks/navigation/useAppNavigation', () => ({
  useAppNavigation: () => ({
    toLogin: mockToLogin,
    toSignUp: mockToSignUp,
  }),
}));

jest.mock('#components/templates/AuthWrapper', () => {
  const { View } = require('react-native');
  return {
    AuthWrapper: ({
      children,
      testID,
    }: {
      children?: React.ReactNode;
      testID?: string;
    }) => <View testID={testID}>{children}</View>,
  };
});

jest.mock('#components/atoms/Button', () => {
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({
      title,
      onPress,
      testID,
    }: {
      title?: string;
      onPress: () => void;
      testID?: string;
    }) => (
      <Pressable onPress={onPress} testID={testID} accessibilityRole="button">
        <Text>{title}</Text>
      </Pressable>
    ),
  };
});

// Environment is auto-mocked via jest.setup.js. Override `getWebAppUrl` so the
// deep-link assertions resolve to `https://app.example.com/...`.
import { getWebAppUrl } from '#utils/environment';
beforeAll(() => {
  (getWebAppUrl as jest.Mock).mockImplementation(
    (path: string) => `https://app.example.com${path}`,
  );
});

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

  it('navigates to Login when Log In button is pressed', async () => {
    const user = userEvent.setup();
    render(<LandingAuthScreen />);
    await user.press(screen.getByTestId('landing-login-button'));
    expect(mockToLogin).toHaveBeenCalledTimes(1);
  });

  it('navigates to SignUp when Sign Up button is pressed', async () => {
    const user = userEvent.setup();
    render(<LandingAuthScreen />);
    await user.press(screen.getByTestId('landing-signup-button'));
    expect(mockToSignUp).toHaveBeenCalledTimes(1);
  });

  it('renders the footer legal text', () => {
    render(<LandingAuthScreen />);
    expect(screen.getByText(/Terms & Conditions/)).toBeTruthy();
    expect(screen.getByText(/Privacy Policy/)).toBeTruthy();
  });
});
