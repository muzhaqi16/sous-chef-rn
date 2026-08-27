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
import { createUISlice, UIState } from '#store/slices/uiSlice';
import { createBarcodeScannerSlice, BarcodeScannerState } from '#store/slices/barcodeScannerSlice';
import { createAppSlice, AppState } from '#store/slices/appSlice';
import { createNetworkSlice, NetworkState } from '#store/slices/networkSlice';
import { createTelemetrySlice, TelemetryState } from '#store/slices/telemetrySlice';
import { RootState } from '#store/index';

type TestRootState = AuthState &
  PreferencesState &
  NavigationState &
  UIState &
  BarcodeScannerState &
  AppState &
  NetworkState &
  TelemetryState;

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
          ...createUISlice(set, get, api),
          ...createBarcodeScannerSlice(set, get, api),
          ...createAppSlice(set, get, api),
          ...createNetworkSlice(set, get, api),
          ...createTelemetrySlice(set, get, api),
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
