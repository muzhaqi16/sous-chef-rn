import React, { type ReactNode } from 'react';
import { ApolloClient, ApolloLink } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import { MockLink } from '@apollo/client/testing';
import { AppState, type AppStateStatus } from 'react-native';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import {
  connectResyncSources,
  createRefetchEventManager,
} from '#/apollo/refetchEvents';
import { useStore } from '#store';
import {
  completeMockedResponse,
  recordMock,
} from '#/test-utils/apolloMockProvider';
import { GetUnreadNotificationsDocument } from '#features/notifications/graphql/notifications.generated';
import { useNotificationsOnLaunch } from '../useNotificationsOnLaunch';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');
jest.mock('#/apollo/offlineQueue/queueManager', () => ({
  queueManager: { whenIdle: jest.fn(async () => {}) },
}));

let mockFireDeferred: (() => void) | null = null;
jest.mock('../useDeferredCallback', () => ({
  useDeferredCallback: (callback: () => void, enabled: boolean) => {
    mockFireDeferred = enabled ? callback : null;
  },
}));

const USER = {
  id: 'user-1',
  email: 'tani@example.com',
  emailVerified: true,
  onBoarded: true,
};

const emitAppState = (next: AppStateStatus) =>
  (AppState.addEventListener as jest.Mock).mock.calls
    .filter(([event]) => event === 'change')
    .forEach(([, listener]) => (listener as (s: AppStateStatus) => void)(next));

function setup() {
  const unread = recordMock(GetUnreadNotificationsDocument, {
    data: { me: { id: USER.id } },
  });
  // Counted at the link: MockLink matches variables once per mock, not per request.
  const requests: string[] = [];
  const countRequests = new ApolloLink((operation, forward) => {
    requests.push(operation.operationName ?? '');
    return forward(operation);
  });
  const client = new ApolloClient({
    cache: makeCache(),
    defaultOptions: APOLLO_DEFAULT_OPTIONS,
    link: ApolloLink.from([
      countRequests,
      new MockLink([completeMockedResponse(unread.mock)]),
    ]),
    refetchEventManager: createRefetchEventManager(),
  });
  connectResyncSources(client);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApolloProvider client={client}>{children}</ApolloProvider>
  );
  return { client, requests, wrapper };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFireDeferred = null;
  useStore.setState({ user: USER, apiReachable: true, isOnline: true });
});

afterEach(() => {
  useStore.setState({ user: null });
  jest.useRealTimers();
});

/** Past the resync's settle window and its cap, on the fake clock. */
const pastTheResyncWindow = () =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(6_000);
  });

describe('useNotificationsOnLaunch', () => {
  it('waits for the deferred start before loading unread notifications', async () => {
    const { requests, wrapper, client } = setup();
    renderHook(() => useNotificationsOnLaunch(USER.id), { wrapper });

    await act(() => new Promise(resolve => setTimeout(resolve, 0)));
    expect(requests).toEqual([]);

    act(() => mockFireDeferred?.());
    await waitFor(() => expect(requests).toEqual(['GetUnreadNotifications']));
    client.stop();
  });

  it('reaches the network again when the app returns to the foreground', async () => {
    jest.useFakeTimers();
    const { requests, wrapper, client } = setup();
    renderHook(() => useNotificationsOnLaunch(USER.id), { wrapper });
    act(() => mockFireDeferred?.());
    // Landed, not just sent: a refetch while the first request is in flight
    // joins it rather than reaching the network.
    await waitFor(() =>
      expect(
        client.readQuery({ query: GetUnreadNotificationsDocument }),
      ).not.toBeNull(),
    );
    expect(requests).toEqual(['GetUnreadNotifications']);

    act(() => {
      emitAppState('background');
      emitAppState('active');
    });
    await pastTheResyncWindow();

    await waitFor(() =>
      expect(requests).toEqual([
        'GetUnreadNotifications',
        'GetUnreadNotifications',
      ]),
    );
    client.stop();
  });

  it('loads nothing while signed out', async () => {
    const { requests, wrapper, client } = setup();
    renderHook(() => useNotificationsOnLaunch(undefined), { wrapper });

    expect(mockFireDeferred).toBeNull();
    await act(() => new Promise(resolve => setTimeout(resolve, 0)));
    expect(requests).toEqual([]);
    client.stop();
  });
});
