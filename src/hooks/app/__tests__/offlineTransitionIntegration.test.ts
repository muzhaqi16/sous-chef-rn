/**
 * Guard: going offline must leave the app actually treating itself as offline.
 *
 * The existing coverage could not see this. `useOnlineQueueSync.test.ts` mocks
 * BOTH the store and `apiReachabilityBreaker`, so the real `reset()` never runs;
 * `networkSlice.test.ts` drives the real store but never runs the hook's effect.
 * The bug lived exactly in the seam between them: `setOffline` correctly moves
 * `apiReachable` to `null`, and the effect then called `reset()` — which ends in
 * an unconditional `setApiReachable(true)` — BEFORE branching on `isOnline`.
 * `shouldTreatAsOffline` is `!isOnline && apiReachable !== true`, so the whole
 * offline window ran as if online.
 *
 * So this suite wires the REAL store slices to the REAL breaker and only stubs
 * the leaf side effects.
 */
import { renderHook } from '@testing-library/react-native';
import { ApolloLink, Observable, gql } from '@apollo/client';
import type { ApolloClient, OperationVariables } from '@apollo/client';
import { OperationTypeNode } from 'graphql';
import type { DocumentNode } from 'graphql';
import { createTestStore } from '#/test-utils/createTestStore';
import {
  blocksCacheMissQueries,
  isApiUnavailable,
  shouldTreatAsOffline,
} from '#store/slices/networkSlice';

// One real store, shared by the hook, the breaker and the link — the point of
// the suite is that they all read the same state.
const mockStore = createTestStore();

jest.mock('#store', () => ({
  useStore: {
    getState: () => mockStore.getState(),
    setState: (...args: unknown[]) =>
      (mockStore.setState as (...a: unknown[]) => void)(...args),
    subscribe: () => () => {},
  },
}));

let mockIsOnline = true;
jest.mock('#store/useAppStore', () => ({
  useIsOnline: () => mockIsOnline,
  useUserId: () => 'user-1',
  useAppStore: (selector: (s: unknown) => unknown) =>
    selector({ accessToken: 'token' }),
}));

jest.mock('#/apollo/offlineQueue/queueManager', () => ({
  queueManager: {
    onOnline: jest.fn(),
    onOffline: jest.fn(),
    requestDrain: jest.fn(),
    withdrawUnqueueableWrite: jest.fn(),
  },
}));
jest.mock('#/apollo/offlineQueue/queueStore', () => ({
  queueStore: { addMutation: jest.fn() },
}));
jest.mock('#/apollo/links/wsLink', () => ({
  resumeWebSocketAfterOnline: jest.fn(),
}));
jest.mock('#/apollo/links/refreshToken', () => ({
  proactiveTokenRefresh: jest.fn(() => Promise.resolve(null)),
}));
jest.mock('#/apollo/links/apiHealthProbe', () => ({
  probeApiHealth: jest.fn(() => Promise.resolve(false)),
}));

import { useOnlineQueueSync } from '../useOnlineQueueSync';
import { apiReachabilityBreaker } from '#/apollo/links/apiReachabilityBreaker';
import { createQueueLink } from '#/apollo/offlineQueue/queueLink';
import { OfflineRejectedError } from '#/apollo/offlineQueue/OfflineRejectedError';
import { probeApiHealth } from '#/apollo/links/apiHealthProbe';

const ONLINE_ONLY_MUTATION = gql`
  mutation TransferHomeOwnership($input: TransferHomeOwnershipInput!) {
    transferHomeOwnership(input: $input) {
      id
    }
  }
`;

function makeOperation(query: DocumentNode, operationName: string) {
  const context: ApolloLink.OperationContext = {};
  return {
    query,
    operationName,
    operationType: OperationTypeNode.MUTATION,
    variables: {} as OperationVariables,
    getContext: () => context,
    setContext: jest.fn(),
    extensions: {},
    client: {} as ApolloClient,
  } as ApolloLink.Operation;
}

/** Flush the microtask chain behind an async probe under fake timers. */
async function flushProbe() {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

/** Mount the hook online, then drive the real offline transition through it. */
function goOffline() {
  mockIsOnline = true;
  const { rerender } = renderHook(() => useOnlineQueueSync());

  // The real slice action: this is what NetInfo's listener calls, and it is
  // what moves `apiReachable` to unknown.
  mockStore.getState().setOffline();
  mockIsOnline = false;
  rerender({});
  return { rerender };
}

describe('offline transition (real store + real breaker)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockIsOnline = true;
    mockStore.setState({
      isOnline: true,
      apiReachable: true,
      offlineModeEnabled: false,
    });
    apiReachabilityBreaker.reset();
    jest.clearAllMocks();
    (probeApiHealth as jest.Mock).mockResolvedValue(false);
  });

  afterEach(() => {
    mockStore.setState({ isOnline: true, apiReachable: true });
    apiReachabilityBreaker.reset();
    jest.useRealTimers();
  });

  it('treats the device as offline for the whole offline window', () => {
    goOffline();

    const state = mockStore.getState();
    expect(state.isOnline).toBe(false);
    // The heart of it: nothing in the transition may assert reachability.
    expect(state.apiReachable).not.toBe(true);
    expect(shouldTreatAsOffline(state)).toBe(true);
    expect(isApiUnavailable(state)).toBe(true);
  });

  it('answers a cache-miss query through the offline path', () => {
    goOffline();

    expect(blocksCacheMissQueries(mockStore.getState())).toBe(true);
  });

  it('surfaces the offline indicator to the user', () => {
    goOffline();

    // The banner resolves its cause through the same selector; the device-level
    // dwell is the shorter one.
    jest.advanceTimersByTime(2_000);
    expect(mockStore.getState().offlineBannerCause).toBe('device-offline');
  });

  it('fails an online-only mutation fast instead of firing a doomed request', async () => {
    goOffline();

    const link = createQueueLink();
    const forward = jest.fn(
      () =>
        new Observable<ApolloLink.Result>(observer => {
          observer.next({ data: { ok: true } });
          observer.complete();
        }),
    );

    const error = await new Promise<unknown>(resolve => {
      link
        .request(
          makeOperation(ONLINE_ONLY_MUTATION, 'TransferHomeOwnership'),
          forward as unknown as ApolloLink.ForwardFunction,
        )!
        .subscribe({
          next: () => resolve(new Error('expected no result')),
          error: resolve,
          complete: () => resolve(new Error('expected no completion')),
        });
    });

    expect(error).toBeInstanceOf(OfflineRejectedError);
    expect(forward).not.toHaveBeenCalled();
  });

  it('does not leave reachability asserted as true when a probe fails offline', async () => {
    goOffline();

    // `onDeviceOffline` starts the probe loop — the only thing that can turn
    // unknown into a fact while the link is down.
    await jest.advanceTimersByTimeAsync(20_000);
    await flushProbe();

    expect(probeApiHealth).toHaveBeenCalled();
    expect(mockStore.getState().apiReachable).not.toBe(true);
    expect(shouldTreatAsOffline(mockStore.getState())).toBe(true);
  });

  it('proves the API reachable when a probe succeeds despite NetInfo', async () => {
    goOffline();
    (probeApiHealth as jest.Mock).mockResolvedValue(true);

    await jest.advanceTimersByTimeAsync(20_000);
    await flushProbe();

    expect(mockStore.getState().apiReachable).toBe(true);
    expect(shouldTreatAsOffline(mockStore.getState())).toBe(false);
  });

  it('still starts optimistic when the device comes back online', () => {
    const { rerender } = goOffline();

    mockStore.getState().setOnline();
    mockIsOnline = true;
    rerender({});

    const state = mockStore.getState();
    expect(state.apiReachable).toBe(true);
    expect(shouldTreatAsOffline(state)).toBe(false);
    expect(apiReachabilityBreaker._getState()).toBe('closed');
  });
});
