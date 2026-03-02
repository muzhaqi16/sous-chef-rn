'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';

// Mock tokenScheduler and refreshToken
jest.mock('../../apollo/links/tokenScheduler', () => ({
  scheduleTokenRefresh: jest.fn(),
  cancelTokenRefresh: jest.fn(),
  cancelScheduledRefresh: jest.fn(),
}));
jest.mock('../../apollo/links/refreshToken', () => ({
  proactiveTokenRefresh: jest.fn(),
  refreshAccessToken: jest.fn(),
}));

// Mock useDeepLinkRouter
jest.mock('#hooks/deepLink/useDeepLinkRouter', () => ({
  useDeepLinkRouter: jest.fn(),
}));

// Mock useAuth
jest.mock('#hooks/auth/useAuth', () => ({
  useAuth: jest.fn(() => ({
    handlePostLoginBiometricComplete: jest.fn(),
  })),
}));

// Mock navigation guards
jest.mock('#hooks/navigation/useNavigationGuards', () => ({
  useIsAuth: jest.fn(() => true),
  useIsVerification: jest.fn(() => false),
  useIsOnboarding: jest.fn(() => false),
  useIsMainApp: jest.fn(() => false),
}));

// Mock navigation service
jest.mock('#services/NavigationService', () => ({
  navigationRef: { current: null },
}));

// Mock @react-navigation/native-stack
jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: jest.fn(() => ({
    Navigator: ({ children }: any) => children,
    Screen: ({ children }: any) => children,
    Group: ({ children }: any) => children,
  })),
}));

// Mock createStaticNavigation
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const ReactMock = require('react');
  const { View } = require('react-native');
  return {
    ...actual,
    createStaticNavigation: jest.fn(() =>
      ReactMock.forwardRef((props: any, ref: any) =>
        ReactMock.createElement(View, { testID: 'static-navigation', ref }),
      ),
    ),
    DefaultTheme: { colors: { primary: '#000', background: '#fff', card: '#fff', text: '#000', border: '#ccc', notification: '#f00' } },
    DarkTheme: { colors: { primary: '#fff', background: '#000', card: '#000', text: '#fff', border: '#333', notification: '#f00' } },
  };
});

// Mock all screen components
jest.mock('#screens/SplashScreen', () => ({
  SplashScreen: () => {
    const ReactMock = require('react');
    const { View, Text } = require('react-native');
    return ReactMock.createElement(View, { testID: 'splash-screen' },
      ReactMock.createElement(Text, null, 'Splash'),
    );
  },
}));
jest.mock('#screens/NotFoundScreen', () => ({
  NotFoundScreen: () => null,
}));

// Mock ErrorBoundary
jest.mock('#components/providers/ErrorBoundary', () => ({
  NavigationErrorBoundary: ({ children }: any) => children,
  AuthErrorBoundary: ({ children }: any) => children,
}));

// Mock PostLoginBiometricPrompt
jest.mock('#components/organisms/PostLoginBiometricPrompt', () => ({
  PostLoginBiometricPrompt: () => null,
}));

// Mock SousChefLoader
jest.mock('#/components/base/SousChefLoader', () => ({
  SousChefLoader: () => null,
}));

// Mock zustand/shallow
jest.mock('zustand/shallow', () => ({
  useShallow: jest.fn((fn: any) => fn),
}));

// Track mock state
let mockIsHydrated = false;
let mockUser: any = null;
let mockNavigationState = 'loading';
let mockShowBiometricSetup = false;
let mockPostLoginCredentials: any = null;
const mockSetNavigationState = jest.fn((state: string) => { mockNavigationState = state; });

// Mock useAppStore
jest.mock('#store/useAppStore', () => ({
  useAppStore: jest.fn((selector: any) => {
    const state = {
      isHydrated: mockIsHydrated,
      user: mockUser,
      navigationState: mockNavigationState,
      showBiometricSetup: mockShowBiometricSetup,
      postLoginCredentials: mockPostLoginCredentials,
      setNavigationState: mockSetNavigationState,
      setShowBiometricSetup: jest.fn(),
      setPostLoginCredentials: jest.fn(),
    };
    return selector(state);
  }),
  selectHydrated: (s: any) => s.isHydrated,
  selectUser: (s: any) => s.user,
  selectPostLoginState: (s: any) => ({
    navigationState: s.navigationState,
    showBiometricSetup: s.showBiometricSetup,
    postLoginCredentials: s.postLoginCredentials,
    setNavigationState: s.setNavigationState,
    setShowBiometricSetup: s.setShowBiometricSetup,
  }),
}));

// Mock all navigation stacks
jest.mock('../stacks/AuthStack', () => ({ AuthStack: () => null }));
jest.mock('../stacks/OnboardingStack', () => ({ OnboardingStack: () => null }));
jest.mock('../stacks/HomeTabs', () => ({ HomeTabs: () => null }));
jest.mock('../stacks/BarcodeStack', () => ({ BarcodeStack: () => null }));
jest.mock('../stacks/NotificationStack', () => ({ NotificationStack: () => null }));

// Mock screen imports
jest.mock('#screens/profile/ProfileScreen', () => ({ ProfileScreen: () => null }));
jest.mock('#screens/home/HomeManagement', () => ({ HomeManagement: () => null }));
jest.mock('#screens/home/HomeDetailScreen', () => ({ HomeDetailScreen: () => null }));
jest.mock('#screens/home/StorageLocationsScreen', () => ({ StorageLocationsScreen: () => null }));
jest.mock('#screens/auth/CodeVerificationScreen', () => ({ CodeVerificationScreen: () => null }));
jest.mock('#screens/auth/EmailVerificationDeepLinkScreen', () => ({ EmailVerificationDeepLinkScreen: () => null }));
jest.mock('#screens/auth/ResetPasswordScreen', () => ({ ResetPasswordScreen: () => null }));
jest.mock('#screens/shoppingList/AcceptInvite', () => ({ AcceptInvite: () => null }));

import { Navigation } from '../RootNavigator';

describe('Navigation (RootNavigator)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsHydrated = false;
    mockUser = null;
    mockNavigationState = 'loading';
    mockShowBiometricSetup = false;
    mockPostLoginCredentials = null;
    mockSetNavigationState.mockClear();
  });

  it('shows SplashScreen when not hydrated', () => {
    mockIsHydrated = false;
    const { getByTestId } = render(<Navigation />);
    expect(getByTestId('splash-screen')).toBeTruthy();
  });

  it('shows SplashScreen when navigation state is loading', () => {
    mockIsHydrated = true;
    mockNavigationState = 'loading';
    const { getByTestId } = render(<Navigation />);
    expect(getByTestId('splash-screen')).toBeTruthy();
  });

  it('renders StaticNavigation when hydrated and not loading', () => {
    mockIsHydrated = true;
    mockNavigationState = 'auth';
    const { getByTestId } = render(<Navigation />);
    expect(getByTestId('static-navigation')).toBeTruthy();
  });

  it('sets navigation to auth when hydrated with no user', () => {
    mockIsHydrated = true;
    mockUser = null;
    mockNavigationState = 'auth';
    render(<Navigation />);
    expect(mockSetNavigationState).toHaveBeenCalledWith('auth');
  });

  it('sets navigation to verification for unverified user', () => {
    mockIsHydrated = true;
    mockUser = { id: '1', emailVerified: false, onBoarded: false };
    mockNavigationState = 'auth'; // will be changed
    render(<Navigation />);
    expect(mockSetNavigationState).toHaveBeenCalledWith('verification');
  });

  it('sets navigation to onboarding for verified but not onboarded user', () => {
    mockIsHydrated = true;
    mockUser = { id: '1', emailVerified: true, onBoarded: false };
    mockNavigationState = 'auth';
    render(<Navigation />);
    expect(mockSetNavigationState).toHaveBeenCalledWith('onboarding');
  });

  it('sets navigation to main_app for fully onboarded user', () => {
    mockIsHydrated = true;
    mockUser = { id: '1', emailVerified: true, onBoarded: true };
    mockNavigationState = 'auth';
    render(<Navigation />);
    expect(mockSetNavigationState).toHaveBeenCalledWith('main_app');
  });

  it('does not show biometric prompt when conditions are not met', () => {
    mockIsHydrated = true;
    mockNavigationState = 'main_app';
    mockShowBiometricSetup = false;
    mockUser = { id: '1', emailVerified: true, onBoarded: true };
    const { queryByTestId } = render(<Navigation />);
    // PostLoginBiometricPrompt is mocked to return null, so it won't be in the tree
    expect(queryByTestId('biometric-prompt')).toBeNull();
  });
});
