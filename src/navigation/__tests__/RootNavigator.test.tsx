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

// Mock screen imports
jest.mock('#features/profile/screens/ProfileScreen', () => ({
  ProfileScreen: () => null,
}));
jest.mock('#screens/home/HomeManagement', () => ({
  HomeManagement: () => null,
}));
jest.mock('#screens/home/HomeDetailScreen', () => ({
  HomeDetailScreen: () => null,
}));
jest.mock('#screens/home/StorageLocationsScreen', () => ({
  StorageLocationsScreen: () => null,
}));
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

// Feature detail/sub screens — now registered at the root level (siblings of
// Home), so RootNavigator imports them directly. Mock them so the test doesn't
// load their heavy real modules (e.g. bottom-sheet scrollables).
jest.mock('#features/pantry/screens/PantryItemScreen', () => ({
  PantryItemScreen: () => null,
}));
jest.mock('#features/pantry/screens/PantryItemDetail', () => ({
  PantryItemDetail: () => null,
}));
jest.mock('#features/pantry/screens/FilteredPantryItems', () => ({
  FilteredPantryItems: () => null,
}));
jest.mock('#features/pantry/screens/PantrySettings', () => ({
  PantrySettings: () => null,
}));
jest.mock('#features/pantry/screens/NutritionScreen', () => ({
  NutritionScreen: () => null,
}));
jest.mock('#features/pantry/screens/PantryAnalytics', () => ({
  PantryAnalytics: () => null,
}));
jest.mock('#features/recipes/screens/RecipeDetail', () => ({
  RecipeDetail: () => null,
}));
jest.mock('#features/recipes/screens/RecipeForm', () => ({
  RecipeFormScreen: () => null,
}));
jest.mock('#features/recipes/screens/SavedRecipes', () => ({
  SavedRecipes: () => null,
}));
jest.mock('#features/recipes/screens/MyRecipes', () => ({
  MyRecipes: () => null,
}));
jest.mock('#features/shoppingList/screens/ListSettings', () => ({
  ListSettings: () => null,
}));
jest.mock('#features/shoppingList/screens/ShareList', () => ({
  ShareList: () => null,
}));
jest.mock('#features/shoppingList/screens/AddEditItem', () => ({
  AddEditItem: () => null,
}));
jest.mock('#features/shoppingList/screens/ItemDetail', () => ({
  ShoppingListItemDetail: () => null,
}));
jest.mock('#features/shoppingList/screens/PurchaseHistoryScreen', () => ({
  PurchaseHistoryScreen: () => null,
}));
jest.mock('#features/mealPlan/screens/CreateMealPlanScreen', () => ({
  CreateMealPlanScreen: () => null,
}));

// Mock the feature registry so stacks don't load real screen modules
jest.mock('#features/registry', () => ({
  TAB_FEATURES: [],
  FEATURE_DEEP_LINK_SCREENS: [],
  FEATURE_REGISTRY: [],
}));

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Navigation, featureDetailOptions } from '../RootNavigator';

// The static config passed to the (mocked) navigator factory. `createNativeStackScreen`
// is mocked as identity, so each screen entry is its raw `{ screen, options, linking }`
// config. Captured once here at import time because beforeEach's `clearAllMocks`
// wipes `mock.calls`.
const rootStackConfig = (createNativeStackNavigator as jest.Mock).mock
  .calls[0][0] as {
  groups: Record<
    string,
    {
      screens: Record<string, { options?: unknown; linking?: unknown }>;
    }
  >;
};

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

describe('deep-link safety — lifted feature screens', () => {
  // The lifted feature detail/sub screens all share the `featureDetailOptions`
  // reference. The app enables deep linking with only `prefixes` (no
  // `enabled: 'auto'`), so a screen is deep-linkable purely by what it declares.
  // Every lifted screen must therefore declare an explicit `linking` intent —
  // `linking: null` to opt out, or a path string to keep a shared link working.
  // This locks the invariant against future screen additions that forget it.
  it('every lifted feature screen declares an explicit linking intent', () => {
    const mainAppScreens = rootStackConfig.groups.MainApp.screens;
    const liftedScreens = Object.entries(mainAppScreens).filter(
      ([, config]) => config.options === featureDetailOptions,
    );

    // Sanity: the reference filter actually matched the lifted screens (guards
    // against featureDetailOptions being refactored out from under the test).
    expect(liftedScreens.length).toBeGreaterThanOrEqual(19);

    for (const [name, config] of liftedScreens) {
      const declaresIntent =
        config.linking === null ||
        (typeof config.linking === 'string' && config.linking.length > 0);

      // Object form so a failure names the offending screen and its value.
      expect({ screen: name, linking: config.linking, declaresIntent }).toEqual(
        expect.objectContaining({ declaresIntent: true }),
      );
    }
  });

  it('lifted feature screens are not deep-linkable (all opt out with linking: null)', () => {
    const mainAppScreens = rootStackConfig.groups.MainApp.screens;
    const liftedScreens = Object.entries(mainAppScreens).filter(
      ([, config]) => config.options === featureDetailOptions,
    );

    for (const [name, config] of liftedScreens) {
      expect({ screen: name, linking: config.linking }).toEqual({
        screen: name,
        linking: null,
      });
    }
  });
});
