import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import type { User } from '#store/slices/authSlice';
import type { NavigationState } from '#store/slices/appSlice';
import { useStore } from '#store';
import { Telemetry } from '#services/telemetry';
import NavigationService, { navigationRef } from '#services/NavigationService';
import { NativePerformanceService } from '#services/performance/NativePerformanceService';

interface ChildrenProps {
  children?: React.ReactNode;
}

// Mock @react-navigation/native-stack
// The root stack is built at import time, so its config is captured here rather
// than read from `mock.calls` — `clearAllMocks` in beforeEach would have
// discarded the call by the time any test runs.
interface RootScreenConfig {
  screen: unknown;
  options?: Record<string, unknown>;
}
interface RootStackConfig {
  screens?: Record<string, RootScreenConfig>;
  groups?: Record<string, { screens?: Record<string, RootScreenConfig> }>;
}
let mockRootStackConfig: RootStackConfig | undefined;

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: jest.fn((config: RootStackConfig) => {
    mockRootStackConfig = config;
    return {
      Navigator: ({ children }: ChildrenProps) => children,
      Screen: ({ children }: ChildrenProps) => children,
      Group: ({ children }: ChildrenProps) => children,
    };
  }),
  createNativeStackScreen: jest.fn(<T,>(config: T): T => config),
}));

/** The props the navigator hands the static navigation container. */
const mockStaticProps: { current: Record<string, unknown> } = { current: {} };
// Mock createStaticNavigation
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const ReactMock = require('react');
  const { View } = require('react-native');
  return {
    ...actual,
    createStaticNavigation: jest.fn(() =>
      // The real container ref stays unattached, as before a container mounts.
      ReactMock.forwardRef((props: Record<string, unknown>) => {
        mockStaticProps.current = props;
        return ReactMock.createElement(View, { testID: 'static-navigation' });
      }),
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

// Mock the post-login biometric screen (rendered only in the biometric_setup group)
jest.mock('#features/auth/screens/PostLoginBiometricScreen', () => ({
  PostLoginBiometricScreen: () => null,
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
// feature stands in for every screen in the group, and keeps the real
// (heavy) screen modules out of this suite. The linking-intent
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
jest.mock('#features/home/screens/registration', () => ({
  homeManagementScreens: {},
}));

// Mock screen imports — only what RootNavigator.tsx itself still imports
// directly.
jest.mock('#features/auth/screens/CodeVerificationScreen', () => ({
  CodeVerificationScreen: () => null,
}));
jest.mock('#features/auth/screens/EmailVerificationDeepLinkScreen', () => ({
  EmailVerificationDeepLinkScreen: () => null,
}));
jest.mock('#features/auth/screens/ResetPasswordScreen', () => ({
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

/** Every root screen, flattened across the conditional groups. */
const rootScreens = (): Record<string, RootScreenConfig> => ({
  ...mockRootStackConfig?.screens,
  ...Object.values(mockRootStackConfig?.groups ?? {}).reduce<
    Record<string, RootScreenConfig>
  >((all, group) => ({ ...all, ...group.screens }), {}),
});

/** The store as this launch finds it. */
function given({
  isHydrated = true,
  user = null,
  navigationState = 'loading',
  postLoginCredentials = null,
  verificationSkipped = false,
}: {
  isHydrated?: boolean;
  user?: User | null;
  navigationState?: NavigationState;
  postLoginCredentials?: { email: string } | null;
  verificationSkipped?: boolean;
} = {}) {
  useStore.setState({
    isHydrated,
    user,
    navigationState,
    postLoginCredentials,
    userNavigationStates: user ? { [user.id]: { verificationSkipped } } : {},
  });
}

const account = (emailVerified: boolean, onBoarded: boolean): User => ({
  id: '1',
  email: 'test@example.com',
  emailVerified,
  onBoarded,
});

const routedTo = () => useStore.getState().navigationState;

const LAUNCHES: Array<[string, User | null, boolean, NavigationState]> = [
  ['no one signed in', null, false, 'auth'],
  ['an unverified account', account(false, false), false, 'verification'],
  ['a skipped verification', account(false, true), true, 'main_app'],
  [
    'a skipped verification not onboarded',
    account(false, false),
    true,
    'onboarding',
  ],
  [
    'a verified account not onboarded',
    account(true, false),
    false,
    'onboarding',
  ],
  ['a fully set-up account', account(true, true), false, 'main_app'],
];

describe('Navigation (RootNavigator)', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    mockStaticProps.current = {};
  });

  // The tab subtree must survive a detail screen being pushed over it, or
  // popping back re-runs every layout effect under HomeTabs in one commit.
  it('keeps the Home screen mounted while a detail screen is pushed over it', () => {
    expect(rootScreens().Home?.options?.inactiveBehavior).toBe('none');
  });

  it('leaves every other root screen on the default pausing behaviour', () => {
    const optedOut = Object.entries(rootScreens())
      .filter(([, config]) => config.options?.inactiveBehavior === 'none')
      .map(([name]) => name);

    expect(optedOut).toEqual(['Home']);
  });

  it('shows the splash before the store hydrates, and decides nothing', () => {
    given({ isHydrated: false, navigationState: 'main_app' });

    render(<Navigation />);

    expect(screen.getByTestId('splash-screen')).toBeTruthy();
    expect(routedTo()).toBe('main_app');
  });

  it('opens the navigation, ready to replay what was asked before it', () => {
    given({ navigationState: 'auth' });

    render(<Navigation />);

    expect(screen.getByTestId('static-navigation')).toBeTruthy();
    expect(mockStaticProps.current.onReady).toBe(
      NavigationService.flushPendingNavigation,
    );
  });

  it.each(LAUNCHES)(
    'routes a launch with %s',
    (_, user, verificationSkipped, target) => {
      given({ user, verificationSkipped, navigationState: 'auth' });

      render(<Navigation />);

      expect(routedTo()).toBe(target);
    },
  );

  describe('a sign-in that holds a gate', () => {
    it('stays on biometric setup when the account reaches the app', () => {
      given({ navigationState: 'auth' });
      render(<Navigation />);

      act(() => {
        useStore.setState({
          navigationState: 'biometric_setup',
          user: account(true, true),
        });
      });

      expect(routedTo()).toBe('biometric_setup');
    });

    it("stays for the sign-in screen's remember-me question", () => {
      given({ navigationState: 'auth' });
      render(<Navigation />);

      act(() => {
        useStore.setState({
          postLoginCredentials: { email: 'test@example.com' },
          user: account(true, true),
        });
      });

      expect(routedTo()).toBe('auth');
    });
  });

  it('reports each screen once, however often the state changes', () => {
    const listeners: Array<() => void> = [];
    jest
      .spyOn(navigationRef, 'addListener')
      .mockImplementation((_event, listener) => {
        listeners.push(() => {
          listener({ type: 'state', data: { state: undefined } });
        });
        return () => undefined;
      });
    jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
    const current = jest.spyOn(navigationRef, 'getCurrentRoute');
    given({ navigationState: 'auth' });
    render(<Navigation />);
    const stateChanged = () => listeners.forEach(listener => listener());

    current.mockReturnValue({ key: 'a', name: 'PantryMain' });
    stateChanged();
    stateChanged();
    current.mockReturnValue({ key: 'b', name: 'RecipeMain' });
    stateChanged();

    expect(jest.mocked(Telemetry.trackScreen).mock.calls).toEqual([
      ['PantryMain'],
      ['RecipeMain'],
    ]);
  });

  describe('the app_fully_drawn_ms interactive gate', () => {
    const gate = () =>
      jest.spyOn(NativePerformanceService, 'noteInteractiveGate');

    // `navigationState` is persisted: a launch straight into the app after a
    // session that ended on sign-in has no human wait to exclude.
    it('does not suppress the metric when only the PERSISTED state was a gate', () => {
      const noted = gate();
      given({ navigationState: 'auth', user: account(true, true) });

      render(<Navigation />);

      expect(routedTo()).toBe('main_app');
      expect(noted).not.toHaveBeenCalled();
    });

    it('suppresses the metric when THIS launch resolves to a gate', () => {
      const noted = gate();
      given({ navigationState: 'main_app' });

      render(<Navigation />);

      expect(routedTo()).toBe('auth');
      expect(noted).toHaveBeenCalledTimes(1);
    });

    it('suppresses on a verification gate too, not just sign-in', () => {
      const noted = gate();
      given({ user: account(false, false) });

      render(<Navigation />);

      expect(routedTo()).toBe('verification');
      expect(noted).toHaveBeenCalledTimes(1);
    });
  });
});
