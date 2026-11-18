/**
 * The app's shell: the splash until the core is ready, then the navigation
 * inside the app's providers. The screens behind the navigator, the network
 * client and the native services are its boundary; Detox drives the rest.
 */

// What the navigator renders stands in for every screen behind it, reading
// the form renderers the shell supplies.
jest.mock('../src/navigation/RootNavigator', () => {
  const { Text } = jest.requireActual('react-native');
  const { useFieldRenderers } = jest.requireActual(
    '../src/components/molecules/fieldRenderers',
  );
  return {
    Navigation: () => (
      <Text testID="navigation">
        {Object.keys(useFieldRenderers()).sort().join(',')}
      </Text>
    ),
  };
});

// Native SDKs and the network client: the app's boundary.
jest.mock('../src/hooks/app/useNetworkStatusSync', () => ({
  useNetworkStatusSync: jest.fn(),
}));
jest.mock('../src/services/performance/MemoryMonitor', () => ({
  MemoryMonitor: { start: jest.fn(), stop: jest.fn() },
}));
jest.mock('../src/services/performance/NativePerformanceService', () => ({
  NativePerformanceService: {
    initialize: jest.fn(),
    cleanup: jest.fn(),
    noteInteractiveGate: jest.fn(),
  },
}));
jest.mock('react-native-screens', () => ({
  enableScreens: jest.fn(),
  enableFreeze: jest.fn(),
}));
// The persisted cache and the app's client open sockets and timers that keep
// Jest alive; an offline client stands in.
jest.mock('../src/apollo/client', () => ({
  restorePersistedCache: jest.fn(),
  flushCachePersistence: jest.fn(),
}));
jest.mock('../src/app/apolloClient', () => {
  const { ApolloClient, ApolloLink, InMemoryCache } =
    jest.requireActual('@apollo/client');
  return {
    client: new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
    }),
  };
});

import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { useStore } from '../src/store';
import { kitTestIDs } from '../src/components/testIDs';
import { catalogFieldRenderers } from '../src/features/catalog/ui/catalogFieldRenderers';
import App from '../App';

beforeEach(() => {
  useStore.setState({ isHydrated: false });
});

describe('the app', () => {
  it('shows the splash until the core is ready', () => {
    render(<App />);

    expect(screen.getByTestId(kitTestIDs.splashScreen)).toBeTruthy();
    expect(screen.queryByTestId('navigation')).not.toBeOnTheScreen();
  });

  it('opens the navigation once ready, with the named form fields supplied', () => {
    render(<App />);

    act(() => {
      useStore.setState({ isHydrated: true });
    });

    expect(screen.queryByTestId(kitTestIDs.splashScreen)).not.toBeOnTheScreen();
    expect(screen.getByTestId('navigation')).toHaveTextContent(
      Object.keys(catalogFieldRenderers).sort().join(','),
    );
  });
});
