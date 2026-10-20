/**
 * A host that adds no start-up steps starts the same core: in node, with every
 * React Native package unloadable, start-up completes, a sign-in opens the
 * signed-in subscriptions and a sign-out closes them.
 */
import { act, createElement } from 'react';
// The renderer React Native Testing Library runs every mobile suite on, which
// this project cannot load: it requires React Native.
import { create } from 'react-test-renderer';
import { ApolloClient, ApolloLink, InMemoryCache } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import { getMainDefinition } from '@apollo/client/utilities';
import { OperationTypeNode } from 'graphql';
import { Observable } from 'rxjs';
import { registerApolloClient } from '#/apollo/clientRegistry';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { CoreSubscriptionProvider } from '#bootstrap/CoreSubscriptionProvider';
import { startCore } from '#bootstrap/startCore';
import { useCoreLifecycle } from '#bootstrap/useCoreLifecycle';
import { requirePlatform } from '#platform/install';
import { authService } from '#/services/authService';
import { useStore } from '#store';

/** Subscriptions the server holds open, by operation name. */
const open: string[] = [];

// Answers nothing: a query stays in flight, a subscription stays open until
// the client lets it go.
const serverLink = new ApolloLink(
  operation =>
    new Observable(() => {
      const definition = getMainDefinition(operation.query);
      const isSubscription =
        'operation' in definition &&
        definition.operation === OperationTypeNode.SUBSCRIPTION;
      if (isSubscription) open.push(operation.operationName ?? '');
      return () => {
        if (!isSubscription) return;
        open.splice(open.indexOf(operation.operationName ?? ''), 1);
      };
    }),
);

function CoreRoot() {
  useCoreLifecycle();
  return null;
}

const realFetch = globalThis.fetch;

beforeAll(() => {
  // The sign-out's refresh-token revoke finds no network and stays parked.
  globalThis.fetch = jest.fn(() =>
    Promise.reject(new TypeError('Network request failed')),
  );
  // react-test-renderer reports updates outside `act` unless told it is a test.
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});

afterAll(() => {
  globalThis.fetch = realFetch;
  jest.useRealTimers();
});

it('starts, opens subscriptions on sign-in and closes them on sign-out', async () => {
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: serverLink,
    defaultOptions: APOLLO_DEFAULT_OPTIONS,
  });
  registerApolloClient(client);
  startCore({ client });
  jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] });

  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      createElement(ApolloProvider, {
        client,
        children: createElement(CoreSubscriptionProvider, {
          children: createElement(CoreRoot),
        }),
      }),
    );
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(10);
  });

  // Start-up ran: the device has its identity.
  expect(useStore.getState().isHydrated).toBe(true);
  await expect(requirePlatform('secureStore').loadDeviceId()).resolves.toEqual(
    expect.objectContaining({ status: 'ok' }),
  );

  await act(async () => {
    useStore.getState().setAuth(
      {
        id: 'user-1',
        email: 'chef@example.com',
        emailVerified: true,
        onBoarded: true,
      },
      'access-token',
      'refresh-token',
    );
  });
  // Subscriptions open once the start-up window has passed.
  await act(async () => {
    await jest.advanceTimersByTimeAsync(3000);
  });

  expect(open).toContain('UserEvents');

  await act(async () => {
    await authService.logout();
    await jest.advanceTimersByTimeAsync(10);
  });

  expect(open).toEqual([]);

  await act(async () => {
    renderer?.unmount();
  });
});
