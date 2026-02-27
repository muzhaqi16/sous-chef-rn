/**
 * Creates isolated Zustand stores for slice-level testing.
 *
 * Each call produces a fresh store instance so tests don't leak
 * state to each other. The store mirrors the real middleware stack
 * (immer + subscribeWithSelector) minus persistence.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';
import { createAuthSlice, AuthState } from '#store/slices/authSlice';
import { createPreferencesSlice, PreferencesState } from '#store/slices/preferencesSlice';
import { createNavigationSlice, NavigationState } from '#store/slices/navigationSlice';
import { createNotificationSlice, NotificationState } from '#store/slices/notificationSlice';
import { createUISlice, UIState } from '#store/slices/uiSlice';
import { createBarcodeScannerSlice, BarcodeScannerState } from '#store/slices/barcodeScannerSlice';
import { RootState } from '#store/index';

type TestRootState = AuthState &
  PreferencesState &
  NavigationState &
  NotificationState &
  UIState &
  BarcodeScannerState;

/**
 * Create a fully isolated store for testing.
 *
 * @param initialOverrides - Partial state to seed the store with before the test runs.
 */
export function createTestStore(initialOverrides?: Partial<TestRootState>) {
  const store = create<RootState>()(
    subscribeWithSelector(
      immer((set, get, api) => {
        const base = {
          ...createAuthSlice(set, get, api),
          ...createPreferencesSlice(set, get, api),
          ...createNavigationSlice(set, get, api),
          ...createNotificationSlice(set, get, api),
          ...createUISlice(set, get, api),
          ...createBarcodeScannerSlice(set, get, api),
          // Stubs for RootState fields that live outside the slices under test
          isHydrated: true,
          isLoggingOut: false,
          setHydrated: jest.fn(),
          registrationPassword: null,
          setRegistrationPassword: jest.fn(),
          postLoginCredentials: null,
          setPostLoginCredentials: jest.fn(),
          clearPostLoginCredentials: jest.fn(),
          // Reset manager stubs
          resetStore: jest.fn(),
          logout: jest.fn(),
          fullReset: jest.fn(),
          sessionExpired: jest.fn(),
          resetOnboarding: jest.fn(),
          tokenRefreshFailed: jest.fn(),
          // Navigation state manager stubs
          initiateLogout: jest.fn(() => true),
          completeLogout: jest.fn(() => true),
          // Telemetry stubs
          telemetryEnabled: true,
          setTelemetryEnabled: jest.fn(),
          // Network stubs
          isOnline: true,
          isInternetReachable: true,
          networkType: 'wifi',
          lastOnlineTime: null,
          lastOfflineTime: null,
          setNetworkState: jest.fn(),
        } as unknown as RootState;

        return base;
      }),
    ),
  );

  // Apply initial overrides if provided
  if (initialOverrides) {
    store.setState(initialOverrides as Partial<RootState>);
  }

  return store;
}
