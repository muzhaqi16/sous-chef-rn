'use no memo';

import { renderHook } from '@testing-library/react-native';
import { Alert } from 'react-native';
import {
  useQueryWithComplexityHandling,
  useValidatedPagination,
} from '../useQueryWithComplexityHandling';

jest.spyOn(Alert, 'alert');

jest.mock('#/utils/errors/queryComplexity', () => ({
  handleQueryComplexityError: jest.fn(() => true),
  isQueryComplexityError: jest.fn(() => false),
}));

jest.mock('#/constants/pagination', () => ({
  validatePagination: jest.fn((params: Record<string, number | undefined>) => {
    const MAX = 100;
    return {
      first: params.first ? Math.min(params.first, MAX) : params.first,
      last: params.last ? Math.min(params.last, MAX) : params.last,
      limit: params.limit ? Math.min(params.limit, MAX) : params.limit,
      take: params.take ? Math.min(params.take, MAX) : params.take,
    };
  }),
}));

// Import mocked modules for controlling behavior per-test
import { isQueryComplexityError } from '#/utils/errors/queryComplexity';

const mockIsQueryComplexityError = isQueryComplexityError as jest.Mock;

/** Helper to create a mock error conforming to Apollo's ErrorLike interface */
function createError(message: string, graphQLErrors?: Array<{ extensions: { code: string }; message: string }>) {
  return {
    name: 'ApolloError',
    message,
    ...(graphQLErrors ? { graphQLErrors } : {}),
  };
}

describe('useQueryWithComplexityHandling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsQueryComplexityError.mockReturnValue(false);
  });

  it('returns query result with handleComplexityError function', () => {
    const queryResult = {
      data: { items: [] },
      loading: false,
      error: undefined,
      refetch: jest.fn(),
    };

    const { result } = renderHook(() =>
      useQueryWithComplexityHandling(queryResult),
    );

    expect(result.current.data).toEqual({ items: [] });
    expect(result.current.loading).toBe(false);
    expect(typeof result.current.handleComplexityError).toBe('function');
  });

  it('passes through all original query result properties', () => {
    const queryResult = {
      data: { items: [1, 2, 3] },
      loading: true,
      error: undefined,
      refetch: jest.fn(),
      networkStatus: 7,
    };

    const { result } = renderHook(() =>
      useQueryWithComplexityHandling(queryResult),
    );

    expect(result.current.data).toEqual({ items: [1, 2, 3] });
    expect(result.current.loading).toBe(true);
    expect(result.current.networkStatus).toBe(7);
  });

  it('shows alert when error is a query complexity error', () => {
    mockIsQueryComplexityError.mockReturnValue(true);

    const complexityError = createError('Query too complex', [
      { extensions: { code: 'QUERY_TOO_COMPLEX' }, message: 'Query too complex' },
    ]);

    const queryResult = {
      data: undefined,
      loading: false,
      error: complexityError,
      refetch: jest.fn(),
    };

    renderHook(() => useQueryWithComplexityHandling(queryResult));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Request Too Large',
      'The request was too complex. Please try with fewer items or simplify your request.',
      expect.any(Array),
    );
  });

  it('does not show alert for non-complexity errors', () => {
    mockIsQueryComplexityError.mockReturnValue(false);

    const queryResult = {
      data: undefined,
      loading: false,
      error: createError('Network error'),
      refetch: jest.fn(),
    };

    renderHook(() => useQueryWithComplexityHandling(queryResult));

    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('does not show alert when there is no error', () => {
    const queryResult = {
      data: { items: [] },
      loading: false,
      error: undefined,
      refetch: jest.fn(),
    };

    renderHook(() => useQueryWithComplexityHandling(queryResult));

    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('includes retry button in alert when onRetry is provided', () => {
    mockIsQueryComplexityError.mockReturnValue(true);

    const onRetry = jest.fn();
    const complexityError = createError('Query too complex', [
      { extensions: { code: 'QUERY_TOO_COMPLEX' }, message: 'Query too complex' },
    ]);

    const queryResult = {
      data: undefined,
      loading: false,
      error: complexityError,
      refetch: jest.fn(),
    };

    renderHook(() => useQueryWithComplexityHandling(queryResult, onRetry));

    const alertCalls = (Alert.alert as jest.Mock).mock.calls;
    const buttons = alertCalls[alertCalls.length - 1][2];
    const retryButton = buttons.find((b: any) => b.text === 'Retry');

    expect(retryButton).toBeDefined();
    retryButton.onPress();
    expect(onRetry).toHaveBeenCalled();
  });

  it('only shows alert once per unique error instance', () => {
    mockIsQueryComplexityError.mockReturnValue(true);

    const complexityError = createError('Query too complex', [
      { extensions: { code: 'QUERY_TOO_COMPLEX' }, message: 'Query too complex' },
    ]);

    const queryResult = {
      data: undefined,
      loading: false,
      error: complexityError,
      refetch: jest.fn(),
    };

    const { rerender } = renderHook(() =>
      useQueryWithComplexityHandling(queryResult),
    );

    // Re-render with the same error reference
    rerender({});

    // Count calls that match the complexity alert
    const complexityCalls = (Alert.alert as jest.Mock).mock.calls.filter(
      (call: any[]) => call[0] === 'Request Too Large',
    );
    // Should be exactly 1 (deduped by same error reference)
    expect(complexityCalls.length).toBe(1);
  });

  it('resets alert tracking when error clears', () => {
    mockIsQueryComplexityError.mockReturnValue(true);

    const complexityError = createError('Query too complex', [
      { extensions: { code: 'QUERY_TOO_COMPLEX' }, message: 'Query too complex' },
    ]);

    let queryResult: any = {
      data: undefined,
      loading: false,
      error: complexityError,
      refetch: jest.fn(),
    };

    const { rerender } = renderHook(() =>
      useQueryWithComplexityHandling(queryResult),
    );

    // Error clears
    mockIsQueryComplexityError.mockReturnValue(false);
    queryResult = { ...queryResult, error: undefined };
    rerender({});

    // New complexity error appears
    mockIsQueryComplexityError.mockReturnValue(true);
    const newError = createError('Query too complex again', [
      { extensions: { code: 'QUERY_TOO_COMPLEX' }, message: 'Query too complex again' },
    ]);
    queryResult = { ...queryResult, error: newError };
    rerender({});

    const complexityCalls = (Alert.alert as jest.Mock).mock.calls.filter(
      (call: any[]) => call[0] === 'Request Too Large',
    );
    expect(complexityCalls.length).toBe(2);
  });

  it('handleComplexityError does nothing for non-complexity errors', () => {
    mockIsQueryComplexityError.mockReturnValue(false);

    const queryResult = {
      data: undefined,
      loading: false,
      error: createError('Some error'),
      refetch: jest.fn(),
    };

    const { result } = renderHook(() =>
      useQueryWithComplexityHandling(queryResult),
    );

    // Clear any previous alert calls from render
    (Alert.alert as jest.Mock).mockClear();

    result.current.handleComplexityError();

    expect(Alert.alert).not.toHaveBeenCalled();
  });
});

describe('useValidatedPagination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('caps pagination values to max limit', () => {
    const { result } = renderHook(() =>
      useValidatedPagination({ first: 500, filter: 'active' }),
    );

    expect(result.current.first).toBe(100);
    expect(result.current.filter).toBe('active');
  });

  it('passes through values under the limit', () => {
    const { result } = renderHook(() =>
      useValidatedPagination({ first: 50 }),
    );

    expect(result.current.first).toBe(50);
  });

  it('preserves non-pagination variables', () => {
    const { result } = renderHook(() =>
      useValidatedPagination({ first: 20, status: 'active', search: 'test' }),
    );

    expect(result.current.first).toBe(20);
    expect(result.current.status).toBe('active');
    expect(result.current.search).toBe('test');
  });

  it('validates multiple pagination params', () => {
    const { result } = renderHook(() =>
      useValidatedPagination({ first: 200, last: 150, limit: 300, take: 50 }),
    );

    expect(result.current.first).toBe(100);
    expect(result.current.last).toBe(100);
    expect(result.current.limit).toBe(100);
    expect(result.current.take).toBe(50);
  });
});
