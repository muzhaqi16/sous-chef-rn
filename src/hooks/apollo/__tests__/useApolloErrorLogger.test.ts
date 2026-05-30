'use no memo';

jest.mock('#/services/telemetry', () => ({
  Telemetry: {
    error: jest.fn(),
    increment: jest.fn(),
  },
}));

import { renderHook } from '@testing-library/react-native';
import { useApolloErrorLogger } from '../useApolloErrorLogger';
import { Telemetry } from '#/services/telemetry';

describe('useApolloErrorLogger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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
