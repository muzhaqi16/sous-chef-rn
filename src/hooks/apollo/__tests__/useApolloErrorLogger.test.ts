'use no memo';

jest.mock('#/services/telemetry', () => ({
  Telemetry: {
    error: jest.fn(),
    increment: jest.fn(),
  },
}));

// The dev console-warn branch suppresses the per-component network-error wall
// once the API is known-unavailable — default to "available".
jest.mock('#store', () => ({
  storeApi: { getState: jest.fn(() => ({})) },
}));
jest.mock('#store/slices/networkSlice', () => ({
  isApiUnavailable: jest.fn(() => false),
}));

import { renderHook } from '@testing-library/react-native';
import { useApolloErrorLogger } from '../useApolloErrorLogger';
import { Telemetry } from '#/services/telemetry';
import { isApiUnavailable } from '#store/slices/networkSlice';
import { logger } from '#/utils/environment';

const mockedIsApiUnavailable = isApiUnavailable as jest.Mock;

describe('useApolloErrorLogger', () => {
  // The hook logs through `logger`, which is auto-mocked for every test, so the
  // assertions read its calls rather than the console's. Spying on the console
  // would miss them — and would have to look past the '[WARN]' prefix `logger`
  // prepends, which is what made this test brittle before.
  const warnSpy = logger.warn as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedIsApiUnavailable.mockReturnValue(false);
  });

  afterEach(() => {});

  it('does nothing when error is undefined', () => {
    renderHook(() => useApolloErrorLogger('GetItems', undefined));

    expect(Telemetry.error).not.toHaveBeenCalled();
    expect(Telemetry.increment).not.toHaveBeenCalled();
  });

  it('reports a graphql error to telemetry', () => {
    const error = { message: 'Something went wrong' };
    renderHook(() => useApolloErrorLogger('GetItems', error));

    expect(Telemetry.error).toHaveBeenCalledWith(
      'Apollo query error: GetItems',
      expect.objectContaining({
        operation_name: 'GetItems',
        error_message: 'Something went wrong',
        error_type: 'graphql',
      }),
    );
  });

  it('increments apollo_client_errors_total counter for graphql errors', () => {
    const error = { message: 'Something went wrong' };
    renderHook(() => useApolloErrorLogger('GetItems', error));

    expect(Telemetry.increment).toHaveBeenCalledWith(
      'apollo_client_errors_total',
      1,
      { operation: 'GetItems', type: 'graphql' },
    );
  });

  it('detects cache normalization errors with "Missing field"', () => {
    const error = { message: 'Missing field "name" while computing result' };
    renderHook(() => useApolloErrorLogger('GetPantry', error));

    expect(Telemetry.error).toHaveBeenCalledWith(
      'Apollo cache error: GetPantry',
      expect.objectContaining({
        error_type: 'cache_normalization',
      }),
    );
    expect(Telemetry.increment).toHaveBeenCalledWith(
      'apollo_client_errors_total',
      1,
      { operation: 'GetPantry', type: 'cache' },
    );
  });

  it('detects cache errors with "Cache data may be lost"', () => {
    const error = { message: 'Cache data may be lost when replacing items' };
    renderHook(() => useApolloErrorLogger('GetList', error));

    expect(Telemetry.error).toHaveBeenCalledWith(
      'Apollo cache error: GetList',
      expect.objectContaining({
        error_type: 'cache_normalization',
      }),
    );
  });

  it('detects cache errors with "keyFields"', () => {
    const error = { message: 'Missing keyFields for type Item' };
    renderHook(() => useApolloErrorLogger('GetItems', error));

    expect(Telemetry.error).toHaveBeenCalledWith(
      'Apollo cache error: GetItems',
      expect.objectContaining({
        error_type: 'cache_normalization',
      }),
    );
  });

  it('suppresses the dev query-error log once the API is unavailable, but still reports telemetry', () => {
    mockedIsApiUnavailable.mockReturnValue(true);
    const error = { message: 'Network request failed' };
    renderHook(() => useApolloErrorLogger('GetItems', error));

    const queryWarn = warnSpy.mock.calls.find(
      call => typeof call[0] === 'string' && call[0].includes('Query error'),
    );
    expect(queryWarn).toBeUndefined();
    // Telemetry still fires regardless of reachability.
    expect(Telemetry.error).toHaveBeenCalledWith(
      'Apollo query error: GetItems',
      expect.objectContaining({ error_type: 'graphql' }),
    );
  });

  it('still logs cache errors in dev even when the API is unavailable', () => {
    mockedIsApiUnavailable.mockReturnValue(true);
    const error = { message: 'Missing field "name" while computing result' };
    renderHook(() => useApolloErrorLogger('GetPantry', error));

    const cacheWarn = warnSpy.mock.calls.find(
      call => typeof call[0] === 'string' && call[0].includes('Cache error'),
    );
    expect(cacheWarn).toBeDefined();
  });

  it('does not re-report when error stays the same on rerender', () => {
    const error = { message: 'Some error' };
    const { rerender } = renderHook(
      ({ err }: { err: { message: string } | undefined }) =>
        useApolloErrorLogger('Op', err),
      { initialProps: { err: error as { message: string } | undefined } },
    );

    expect(Telemetry.error).toHaveBeenCalledTimes(1);

    // Same error reference on rerender
    rerender({ err: error });
    expect(Telemetry.error).toHaveBeenCalledTimes(1);
  });
});
