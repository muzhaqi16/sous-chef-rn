import { AppState } from 'react-native';
import { apiReachabilityBreaker } from '../apiReachabilityBreaker';
import { useStore } from '#store';
import { queueManager } from '../../offlineQueue/queueManager';
import { probeApiHealth } from '../apiHealthProbe';

jest.mock('#store', () => ({ useStore: { getState: jest.fn() } }));
jest.mock('../../offlineQueue/queueManager', () => ({
  queueManager: { requestDrain: jest.fn() },
}));
jest.mock('../apiHealthProbe', () => ({ probeApiHealth: jest.fn() }));

const mockedGetState = useStore.getState as jest.Mock;
const mockedProbe = probeApiHealth as jest.Mock;
const setApiReachable = jest.fn();
const INITIAL_PROBE_MS = 20_000;

/**
 * The RN jest mock leaves AppState.currentState as a jest.fn() — pin it to a
 * real status string. (jest.replaceProperty refuses function-valued props, and
 * the module registry is per test file, so no restore is needed.)
 */
function setAppState(state: 'active' | 'background') {
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    writable: true,
    value: state,
  });
}

function mockState(apiReachable = true) {
  mockedGetState.mockReturnValue({ setApiReachable, apiReachable });
}

/** Flush the microtask chain behind an async probe under fake timers. */
async function flushProbe() {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

/** Drive the breaker to the open state (3 consecutive failures). */
function trip() {
  apiReachabilityBreaker.recordFailure();
  apiReachabilityBreaker.recordFailure();
  apiReachabilityBreaker.recordFailure();
}

describe('apiReachabilityBreaker', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    setAppState('active');
    mockState();
    apiReachabilityBreaker.reset(); // singleton — clear state between tests
    jest.clearAllMocks();
    mockState();
    mockedProbe.mockResolvedValue(false);
  });

  afterEach(() => {
    setAppState('active');
    mockState();
    apiReachabilityBreaker.reset();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('opens after the first failure once the /health probe confirms the API is down', async () => {
    mockedProbe.mockResolvedValue(false);
    apiReachabilityBreaker.recordFailure();
    // The probe is the arbiter — not opened synchronously on one failure.
    expect(apiReachabilityBreaker._getState()).toBe('closed');

    await flushProbe();
    expect(mockedProbe).toHaveBeenCalledTimes(1);
    expect(apiReachabilityBreaker._getState()).toBe('open');
    expect(setApiReachable).toHaveBeenCalledWith(false);
  });

  it('forgives a lone failure when the /health probe succeeds (transient blip)', async () => {
    mockedProbe.mockResolvedValue(true);
    apiReachabilityBreaker.recordFailure();
    await flushProbe();

    expect(mockedProbe).toHaveBeenCalledTimes(1);
    expect(apiReachabilityBreaker._getState()).toBe('closed');
    expect(setApiReachable).not.toHaveBeenCalledWith(false);
  });

  it('still opens at the threshold when the arbiter probe cannot resolve', () => {
    // Probe hangs (e.g. /health missing) — the FAILURE_THRESHOLD fallback must
    // still open so a dead API doesn't stay marked reachable.
    mockedProbe.mockImplementation(() => new Promise<boolean>(() => {}));
    apiReachabilityBreaker.recordFailure();
    apiReachabilityBreaker.recordFailure();
    expect(apiReachabilityBreaker._getState()).toBe('closed');
    expect(setApiReachable).not.toHaveBeenCalledWith(false);

    apiReachabilityBreaker.recordFailure();
    expect(apiReachabilityBreaker._getState()).toBe('open');
    expect(setApiReachable).toHaveBeenCalledWith(false);
  });

  it('a success resets the consecutive-failure count', () => {
    apiReachabilityBreaker.recordFailure();
    apiReachabilityBreaker.recordFailure();
    apiReachabilityBreaker.recordSuccess();
    apiReachabilityBreaker.recordFailure();
    apiReachabilityBreaker.recordFailure();
    expect(apiReachabilityBreaker._getState()).toBe('closed');
  });

  it('ignores failures while the app is backgrounded (suspension noise)', () => {
    setAppState('background');
    trip();
    expect(apiReachabilityBreaker._getState()).toBe('closed');
    expect(setApiReachable).not.toHaveBeenCalledWith(false);
  });

  it('probes /health after the delay and closes + drains on success', async () => {
    mockedProbe.mockResolvedValue(true);
    trip();
    expect(apiReachabilityBreaker._getState()).toBe('open');

    jest.advanceTimersByTime(INITIAL_PROBE_MS);
    await flushProbe();

    expect(mockedProbe).toHaveBeenCalledTimes(1);
    expect(apiReachabilityBreaker._getState()).toBe('closed');
    expect(setApiReachable).toHaveBeenLastCalledWith(true);
    expect(queueManager.requestDrain).toHaveBeenCalledTimes(1);
  });

  it('stays open on a failed probe and backs off the next one', async () => {
    trip();

    jest.advanceTimersByTime(INITIAL_PROBE_MS);
    await flushProbe();
    expect(mockedProbe).toHaveBeenCalledTimes(1);
    expect(apiReachabilityBreaker._getState()).toBe('open');

    // Backoff doubles: the next probe fires at 40s, not 20s.
    jest.advanceTimersByTime(INITIAL_PROBE_MS);
    await flushProbe();
    expect(mockedProbe).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(INITIAL_PROBE_MS);
    await flushProbe();
    expect(mockedProbe).toHaveBeenCalledTimes(2);
  });

  it('closes + drains on a real traffic success while open (beats the scheduled probe)', () => {
    trip();
    // The first-failure arbiter probe fired during the burst; capture that
    // baseline so we can assert the SCHEDULED backoff probe adds nothing.
    const probeCalls = mockedProbe.mock.calls.length;
    apiReachabilityBreaker.recordSuccess();

    expect(apiReachabilityBreaker._getState()).toBe('closed');
    expect(setApiReachable).toHaveBeenLastCalledWith(true);
    expect(queueManager.requestDrain).toHaveBeenCalledTimes(1);

    // The pending scheduled probe was cancelled with the circuit.
    jest.advanceTimersByTime(INITIAL_PROBE_MS);
    expect(mockedProbe).toHaveBeenCalledTimes(probeCalls);
  });

  it('a success while already closed still repairs the store flag, without draining', () => {
    // The desync the stuck-offline bug hinged on: store says unreachable,
    // breaker singleton thinks it is closed. Any success must heal the flag.
    mockState(false);
    apiReachabilityBreaker.recordSuccess();

    expect(setApiReachable).toHaveBeenCalledWith(true);
    expect(queueManager.requestDrain).not.toHaveBeenCalled();
  });

  it('onAppForeground probes immediately when the circuit is open', async () => {
    mockedProbe.mockResolvedValue(true);
    trip();
    mockState(false);

    apiReachabilityBreaker.onAppForeground();
    await flushProbe();

    expect(mockedProbe).toHaveBeenCalledTimes(1);
    expect(apiReachabilityBreaker._getState()).toBe('closed');
    expect(setApiReachable).toHaveBeenLastCalledWith(true);
  });

  it('onAppForeground probes a stuck-false flag even when the circuit is closed', async () => {
    mockState(false);
    mockedProbe.mockResolvedValue(true);

    apiReachabilityBreaker.onAppForeground();
    await flushProbe();

    expect(mockedProbe).toHaveBeenCalledTimes(1);
    expect(setApiReachable).toHaveBeenCalledWith(true);
  });

  it('onAppForeground re-opens the circuit when the stuck-flag probe also fails', async () => {
    mockState(false);

    apiReachabilityBreaker.onAppForeground();
    await flushProbe();

    // The probe loop now owns recovery instead of the flag dangling.
    expect(apiReachabilityBreaker._getState()).toBe('open');
  });

  it('onAppForeground does nothing when closed and reachable', async () => {
    apiReachabilityBreaker.onAppForeground();
    await flushProbe();
    expect(mockedProbe).not.toHaveBeenCalled();
  });

  it('reset() returns to closed + reachable and cancels the pending probe', async () => {
    trip();
    expect(apiReachabilityBreaker._getState()).toBe('open');
    const probeCalls = mockedProbe.mock.calls.length;

    apiReachabilityBreaker.reset();
    expect(apiReachabilityBreaker._getState()).toBe('closed');
    expect(setApiReachable).toHaveBeenLastCalledWith(true);

    // The scheduled probe was cancelled; the in-flight arbiter probe resolving
    // post-reset doesn't re-open (counter zeroed, flag reachable) or re-probe.
    jest.advanceTimersByTime(INITIAL_PROBE_MS);
    await flushProbe();
    expect(mockedProbe).toHaveBeenCalledTimes(probeCalls);
    expect(apiReachabilityBreaker._getState()).toBe('closed');
  });

  it('a stale probe failure resolving after reset() does not re-open', async () => {
    let resolveProbe: (reachable: boolean) => void = () => {};
    mockedProbe.mockImplementation(
      () =>
        new Promise<boolean>(resolve => {
          resolveProbe = resolve;
        }),
    );
    trip();
    jest.advanceTimersByTime(INITIAL_PROBE_MS); // probe now in flight

    apiReachabilityBreaker.reset(); // connectivity transition mid-probe
    mockState(true); // reset() made the store reachable again
    setApiReachable.mockClear(); // isolate calls made by the stale resolution

    resolveProbe(false);
    await flushProbe();

    expect(apiReachabilityBreaker._getState()).toBe('closed');
    expect(setApiReachable).not.toHaveBeenCalledWith(false);
  });
});
