'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import type { User } from '#store/slices/authSlice';
import type { NavigationState } from '#store/slices/appSlice';
import type { RootState } from '#store/index';

interface ChildrenProps {
  children?: React.ReactNode;
}

// Mock tokenScheduler and refreshToken
jest.mock('../../apollo/links/tokenScheduler');
jest.mock('../../apollo/links/refreshToken');

// Mock useDeepLinkRouter
jest.mock('#hooks/deepLink/useDeepLinkRouter', () => ({
  useDeepLinkRouter: jest.fn(),
}));

// Mock navigation guards
jest.mock('#hooks/navigation/useNavigationGuards', () => ({
  useIsAuth: jest.fn(() => true),
  useIsVerification: jest.fn(() => false),
  useIsBiometricSetup: jest.fn(() => false),
  useIsOnboarding: jest.fn(() => false),
  useIsMainApp: jest.fn(() => false),
}));

// Mock navigation service
jest.mock('#services/NavigationService', () => ({
  navigationRef: {
    current: null,
    isReady: jest.fn(() => false),
    getCurrentRoute: jest.fn(() => null),
    addListener: jest.fn(() => () => {}),
  },
}));

// Mock @react-navigation/native-stack
jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: jest.fn(() => ({
    Navigator: ({ children }: ChildrenProps) => children,
    Screen: ({ children }: ChildrenProps) => children,
    Group: ({ children }: ChildrenProps) => children,
  })),
  createNativeStackScreen: jest.fn(<T,>(config: T): T => config),
}));

// Mock createStaticNavigation
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const ReactMock = require('react');
  const { View } = require('react-native');
  return {
    ...actual,
    createStaticNavigation: jest.fn(() =>
      ReactMock.forwardRef(
        (_props: Record<string, unknown>, ref: React.Ref<unknown>) =>
          ReactMock.createElement(View, { testID: 'static-navigation', ref }),
      ),
    ),
    DefaultTheme: {
      colors: {
        primary: '#000',
        background: '#fff',
        card: '#fff',
        text: '#000',
        border: '#ccc',
        notification: '#f00',
      },
    },
    DarkTheme: {
      colors: {
        primary: '#fff',
        background: '#000',
        card: '#000',
        text: '#fff',
        border: '#333',
        notification: '#f00',
      },
    },
  };
});

// Mock all screen components
jest.mock('#screens/SplashScreen', () => ({
  SplashScreen: () => {
    const ReactMock = require('react');
    const { View, Text } = require('react-native');
    return ReactMock.createElement(
      View,
      { testID: 'splash-screen' },
      ReactMock.createElement(Text, null, 'Splash'),
    );
  },
}));
jest.mock('#screens/NotFoundScreen', () => ({
  NotFoundScreen: () => null,
}));

// Mock ErrorBoundary
jest.mock('#components/providers/ErrorBoundary', () => ({
  NavigationErrorBoundary: ({ children }: ChildrenProps) => children,
  AuthErrorBoundary: ({ children }: ChildrenProps) => children,
}));

// Mock the post-login biometric screen (rendered only in the biometric_setup group)
jest.mock('#screens/auth/PostLoginBiometricScreen', () => ({
  PostLoginBiometricScreen: () => null,
}));

// Mock SousChefLoader
jest.mock('#/components/base/SousChefLoader', () => ({
  SousChefLoader: () => null,
}));

// Mock zustand/shallow
jest.mock('zustand/shallow', () => ({
  useShallow: jest.fn(<S,>(fn: S): S => fn),
}));

// Track mock state
let mockIsHydrated = false;
let mockUser: User | null = null;
let mockNavigationState: NavigationState = 'loading';
let mockShowBiometricSetup = false;
let mockPostLoginCredentials: { email: string; password: string } | null = null;
const mockSetNavigationState = jest.fn((state: NavigationState) => {
  mockNavigationState = state;
});

// Mock useAppStore
jest.mock('#store/useAppStore', () => ({
  useAppStore: jest.fn(<T,>(selector: (state: RootState) => T) => {
    const state: Partial<RootState> = {
      isHydrated: mockIsHydrated,
      user: mockUser,
      navigationState: mockNavigationState,
      showBiometricSetup: mockShowBiometricSetup,
      postLoginCredentials: mockPostLoginCredentials,
      setNavigationState: mockSetNavigationState,
      setShowBiometricSetup: jest.fn(),
      setPostLoginCredentials: jest.fn(),
    };
    return selector(state as RootState);
  }),
  useIsHydrated: jest.fn(() => mockIsHydrated),
  useUser: jest.fn(() => mockUser),
  usePostLoginState: jest.fn(() => ({
    navigationState: mockNavigationState,
    showBiometricSetup: mockShowBiometricSetup,
    postLoginCredentials: mockPostLoginCredentials,
    setNavigationState: mockSetNavigationState,
    setShowBiometricSetup: jest.fn(),
    setPostLoginCredentials: jest.fn(),
  })),
}));

// Mock all navigation stacks
jest.mock('../stacks/AuthStack', () => ({ AuthStack: () => null }));
jest.mock('../stacks/OnboardingStack', () => ({ OnboardingStack: () => null }));
jest.mock('../stacks/HomeTabs', () => ({ HomeTabs: () => null }));
jest.mock('../stacks/BarcodeStack', () => ({ BarcodeStack: () => null }));
jest.mock('../stacks/NotificationStack', () => ({
  NotificationStack: () => null,
}));

// Feature-owned screen groups spread into the root config. One mock per
// feature replaces the per-screen mocks this file used to carry, and keeps
// the real (heavy) screen modules out of this suite. The linking-intent
// invariant for the screens inside each group is asserted against the real
// module in the feature's own test — see
// features/pantry/screens/__tests__/registration.test.ts.
jest.mock('#features/pantry/screens/registration', () => ({
  pantryDetailScreens: {},
}));
jest.mock('#features/shoppingList/screens/registration', () => ({
  shoppingListDetailScreens: {},
}));
jest.mock('#features/recipes/screens/registration', () => ({
  recipeDetailScreens: {},
}));
jest.mock('#features/mealPlan/screens/registration', () => ({
  mealPlanDetailScreens: {},
}));
jest.mock('#features/profile/screens/registration', () => ({
  profileScreens: {},
}));
jest.mock('#screens/home/registration', () => ({
  homeManagementScreens: {},
}));

// Mock screen imports — only what RootNavigator.tsx itself still imports
// directly.
jest.mock('#screens/auth/CodeVerificationScreen', () => ({
  CodeVerificationScreen: () => null,
}));
jest.mock('#screens/auth/EmailVerificationDeepLinkScreen', () => ({
  EmailVerificationDeepLinkScreen: () => null,
}));
jest.mock('#screens/auth/ResetPasswordScreen', () => ({
  ResetPasswordScreen: () => null,
}));
jest.mock('#features/shoppingList/screens/AcceptInvite', () => ({
  AcceptInvite: () => null,
}));

// Mock the feature registry so stacks don't load real screen modules
jest.mock('#features/registry', () => ({
  TAB_FEATURES: [],
  FEATURE_DEEP_LINK_SCREENS: [],
  FEATURE_REGISTRY: [],
}));

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
    mockUser = {
      id: '1',
      email: 'test@example.com',
      emailVerified: false,
      onBoarded: false,
    };
    mockNavigationState = 'auth'; // will be changed
    render(<Navigation />);
    expect(mockSetNavigationState).toHaveBeenCalledWith('verification');
  });

  it('sets navigation to onboarding for verified but not onboarded user', () => {
    mockIsHydrated = true;
    mockUser = {
      id: '1',
      email: 'test@example.com',
      emailVerified: true,
      onBoarded: false,
    };
    mockNavigationState = 'auth';
    render(<Navigation />);
    expect(mockSetNavigationState).toHaveBeenCalledWith('onboarding');
  });

  it('sets navigation to main_app for fully onboarded user', () => {
    mockIsHydrated = true;
    mockUser = {
      id: '1',
      email: 'test@example.com',
      emailVerified: true,
      onBoarded: true,
    };
    mockNavigationState = 'auth';
    render(<Navigation />);
    expect(mockSetNavigationState).toHaveBeenCalledWith('main_app');
  });

  it('does not show biometric prompt when conditions are not met', () => {
    mockIsHydrated = true;
    mockNavigationState = 'main_app';
    mockShowBiometricSetup = false;
    mockUser = {
      id: '1',
      email: 'test@example.com',
      emailVerified: true,
      onBoarded: true,
    };
    const { queryByTestId } = render(<Navigation />);
    // In main_app the biometric gate is not rendered (it's its own screen under
    // the biometric_setup state, not an overlay), so nothing biometric appears.
    expect(queryByTestId('biometric-prompt')).toBeNull();
  });
});
