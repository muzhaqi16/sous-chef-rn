import { apiReachabilityBreaker } from '../apiReachabilityBreaker';
import { useStore } from '#store';
import { queueManager } from '../../offlineQueue/queueManager';

jest.mock('#store', () => ({ useStore: { getState: jest.fn() } }));
jest.mock('../../offlineQueue/queueManager', () => ({
  queueManager: { requestDrain: jest.fn() },
}));

const mockedGetState = useStore.getState as jest.Mock;
const setApiReachable = jest.fn();
const HALF_OPEN_MS = 20_000;

/** Drive the breaker to the open state (3 consecutive failures). */
function trip() {
  apiReachabilityBreaker.recordFailure();
  apiReachabilityBreaker.recordFailure();
  apiReachabilityBreaker.recordFailure();
}

describe('apiReachabilityBreaker', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockedGetState.mockReturnValue({ setApiReachable });
    apiReachabilityBreaker.reset(); // singleton — clear state between tests
    jest.clearAllMocks();
    mockedGetState.mockReturnValue({ setApiReachable });
  });

  afterEach(() => {
    apiReachabilityBreaker.reset();
    jest.useRealTimers();
  });

  it('stays closed until 3 consecutive failures, then opens', () => {
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

  it('half-opens after the delay, then closes + drains on a probe success', () => {
    trip();
    expect(apiReachabilityBreaker._getState()).toBe('open');

    jest.advanceTimersByTime(HALF_OPEN_MS);
    expect(apiReachabilityBreaker._getState()).toBe('half-open');
    expect(setApiReachable).toHaveBeenLastCalledWith(true);

    apiReachabilityBreaker.recordSuccess();
    expect(apiReachabilityBreaker._getState()).toBe('closed');
    expect(queueManager.requestDrain).toHaveBeenCalledTimes(1);
  });

  it('re-opens immediately on a probe failure while half-open', () => {
    trip();
    jest.advanceTimersByTime(HALF_OPEN_MS);
    expect(apiReachabilityBreaker._getState()).toBe('half-open');

    apiReachabilityBreaker.recordFailure();
    expect(apiReachabilityBreaker._getState()).toBe('open');
  });

  it('does not drain the queue on a success while already closed', () => {
    apiReachabilityBreaker.recordSuccess();
    expect(queueManager.requestDrain).not.toHaveBeenCalled();
  });

  it('reset() returns to closed + reachable and cancels the half-open timer', () => {
    trip();
    expect(apiReachabilityBreaker._getState()).toBe('open');

    apiReachabilityBreaker.reset();
    expect(apiReachabilityBreaker._getState()).toBe('closed');
    expect(setApiReachable).toHaveBeenLastCalledWith(true);

    jest.advanceTimersByTime(HALF_OPEN_MS);
    expect(apiReachabilityBreaker._getState()).toBe('closed');
  });
});
