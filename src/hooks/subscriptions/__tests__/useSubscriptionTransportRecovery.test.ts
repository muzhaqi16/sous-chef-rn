import { act, renderHook } from '@testing-library/react-native';
import { useSubscriptionTransportRecovery } from '../useSubscriptionTransportRecovery';
import { errorService } from '#/services/errorService';

// Typed through the module mock rather than the factory, so the listener
// argument is used rather than declared-and-ignored.
const mockOnWebSocketReconnected = jest.fn((listener: () => void) => {
  capturedReconnectListener = listener;
  return jest.fn();
});
let capturedReconnectListener: (() => void) | undefined;
jest.mock('#/apollo/links/wsLink', () => ({
  onWebSocketReconnected: (listener: () => void) =>
    mockOnWebSocketReconnected(listener),
}));

// `mock`-prefixed so jest allows the factory to close over it.
const mockIsOnline = { value: true };
jest.mock('#store/useAppStore', () => ({
  useIsOnline: () => mockIsOnline.value,
}));

jest.mock('#/services/errorService', () => ({
  errorService: { reportError: jest.fn() },
}));

/**
 * The message shape `GraphQLWsLink` produces when a close ends a subscription.
 * The close code lives in the message and nowhere else, so the tests build it
 * the same way the link does.
 */
const socketClosed = (code?: number, reason = '') =>
  new Error(
    code === undefined
      ? 'Socket closed'
      : `Socket closed with event ${code} ${reason}`,
  );

const renderRecovery = (initial: {
  data?: unknown;
  error?: Error;
  restart: () => void;
  skip?: boolean;
}) =>
  renderHook(
    (props: {
      data?: unknown;
      error?: Error;
      restart: () => void;
      skip?: boolean;
    }) =>
      useSubscriptionTransportRecovery(
        'TestEvents',
        { data: props.data, error: props.error, restart: props.restart },
        props.skip ?? false,
      ),
    { initialProps: initial },
  );

describe('useSubscriptionTransportRecovery', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockIsOnline.value = true;
    capturedReconnectListener = undefined;
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('does nothing while the subscription is healthy', () => {
    const restart = jest.fn();
    renderRecovery({ data: { a: 1 }, restart });

    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    expect(restart).not.toHaveBeenCalled();
  });

  // 4500 is the case this hook exists for: graphql-ws refuses to retry it
  // whatever `shouldRetry` says, so the subscription is finished and only a
  // re-subscribe brings delivery back.
  it('re-subscribes after a close the transport will not retry', () => {
    const restart = jest.fn();
    renderRecovery({
      error: socketClosed(4500, 'Internal server error'),
      restart,
    });

    expect(restart).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1500);
    });

    expect(restart).toHaveBeenCalledTimes(1);
  });

  it('re-subscribes after a connection failure that carries no close code', () => {
    const restart = jest.fn();
    renderRecovery({ error: socketClosed(), restart });

    act(() => {
      jest.advanceTimersByTime(1500);
    });

    expect(restart).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a dead session', 4412],
    ['a refused API key', 4413],
    ['an upgrade requirement', 4411],
    ['a protocol violation', 4400],
  ])('does NOT re-subscribe after %s (%i)', (_label, code) => {
    // These are the codes that latched reconnection off in wsLink. Restarting
    // would dial straight back into the refusal it just stopped for — and the
    // verdict comes from the same table, so the two cannot disagree.
    const restart = jest.fn();
    renderRecovery({ error: socketClosed(code), restart });

    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    expect(restart).not.toHaveBeenCalled();
  });

  it('does not re-subscribe for an error that is not a transport termination', () => {
    const restart = jest.fn();
    renderRecovery({ error: new Error('Validation failed'), restart });

    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    expect(restart).not.toHaveBeenCalled();
  });

  it('never calls restart while skipped, because Apollo throws if it is', () => {
    const restart = jest.fn();
    renderRecovery({ error: socketClosed(4500), restart, skip: true });

    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    expect(restart).not.toHaveBeenCalled();
  });

  it('waits for the device to come back online instead of burning attempts', () => {
    mockIsOnline.value = false;
    const restart = jest.fn();
    const { rerender } = renderRecovery({ error: socketClosed(4500), restart });

    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(restart).not.toHaveBeenCalled();

    mockIsOnline.value = true;
    rerender({ error: socketClosed(4500), restart });
    act(() => {
      jest.advanceTimersByTime(1500);
    });

    expect(restart).toHaveBeenCalledTimes(1);
  });

  it('escalates the delay between attempts and reports once at the cap', () => {
    const restart = jest.fn();
    const error = socketClosed(4500);
    const { rerender } = renderRecovery({ error, restart });

    // Six attempts, each allowed the full 30s ceiling.
    for (let i = 0; i < 6; i++) {
      act(() => {
        jest.advanceTimersByTime(40_000);
      });
      rerender({ error, restart });
    }

    expect(restart).toHaveBeenCalledTimes(6);
    expect(errorService.reportError).toHaveBeenCalledTimes(1);
    expect(errorService.reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('TestEvents'),
      }),
      expect.objectContaining({
        operation: 'subscriptionTransportRecoveryExhausted',
      }),
    );

    // Past the cap it stops rather than dialling forever.
    act(() => {
      jest.advanceTimersByTime(120_000);
    });
    expect(restart).toHaveBeenCalledTimes(6);
  });

  it('re-arms and re-subscribes at once when the socket connects again', () => {
    const restart = jest.fn();
    const error = socketClosed(4500);
    const { rerender } = renderRecovery({ error, restart });

    // Exhaust the attempts.
    for (let i = 0; i < 6; i++) {
      act(() => {
        jest.advanceTimersByTime(40_000);
      });
      rerender({ error, restart });
    }
    expect(restart).toHaveBeenCalledTimes(6);

    // A socket that connected is evidence this can work now — a long outage
    // must not leave the subscription dark for the rest of the session.
    act(() => {
      capturedReconnectListener?.();
    });

    expect(restart).toHaveBeenCalledTimes(7);
  });

  it('resets the escalation once data flows again', () => {
    const restart = jest.fn();
    const error = socketClosed(4500);
    const { rerender } = renderRecovery({ error, restart });

    act(() => {
      jest.advanceTimersByTime(40_000);
    });
    expect(restart).toHaveBeenCalledTimes(1);

    // Delivery resumed: the next failure starts from the base delay again.
    rerender({ data: { a: 1 }, restart });
    rerender({ data: { a: 1 }, error, restart });

    act(() => {
      jest.advanceTimersByTime(1500);
    });
    expect(restart).toHaveBeenCalledTimes(2);
  });
});
