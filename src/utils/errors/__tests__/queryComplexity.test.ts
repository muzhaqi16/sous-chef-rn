import {
  isQueryComplexityError,
  getQueryComplexityDetails,
  getQueryComplexityMessage,
  handleQueryComplexityError,
  validatePaginationParams,
  QueryComplexityErrorType,
} from '../queryComplexity';

describe('isQueryComplexityError', () => {
  it('returns true for graphQLErrors with TOO_COMPLEX code', () => {
    const error = {
      graphQLErrors: [
        { extensions: { code: QueryComplexityErrorType.TOO_COMPLEX } },
      ],
    };
    expect(isQueryComplexityError(error)).toBe(true);
  });

  it('returns true for graphQLErrors with PAGINATION_LIMIT_EXCEEDED code', () => {
    const error = {
      graphQLErrors: [
        { extensions: { code: QueryComplexityErrorType.PAGINATION_LIMIT_EXCEEDED } },
      ],
    };
    expect(isQueryComplexityError(error)).toBe(true);
  });

  it('returns true for error with extensions directly', () => {
    const error = {
      extensions: { code: QueryComplexityErrorType.TOO_COMPLEX },
    };
    expect(isQueryComplexityError(error)).toBe(true);
  });

  it('returns false for unrelated error', () => {
    const error = {
      graphQLErrors: [
        { extensions: { code: 'UNAUTHENTICATED' } },
      ],
    };
    expect(isQueryComplexityError(error)).toBe(false);
  });

  it('returns false for error without extensions', () => {
    const error = { message: 'some error' };
    expect(isQueryComplexityError(error)).toBe(false);
  });
});

describe('getQueryComplexityDetails', () => {
  it('extracts details from graphQLErrors', () => {
    const error = {
      graphQLErrors: [
        {
          message: 'Query too complex',
          extensions: {
            code: QueryComplexityErrorType.TOO_COMPLEX,
            maxDepth: 10,
            actualDepth: 15,
          },
        },
      ],
    };
    const details = getQueryComplexityDetails(error);
    expect(details).not.toBeNull();
    expect(details!.errorType).toBe(QueryComplexityErrorType.TOO_COMPLEX);
    expect(details!.message).toBe('Query too complex');
    expect(details!.maxDepth).toBe(10);
    expect(details!.actualDepth).toBe(15);
  });

  it('extracts details from error with extensions directly', () => {
    const error = {
      message: 'Pagination limit',
      extensions: {
        code: QueryComplexityErrorType.PAGINATION_LIMIT_EXCEEDED,
        maxPagination: 100,
        requestedPagination: 500,
      },
    };
    const details = getQueryComplexityDetails(error);
    expect(details).not.toBeNull();
    expect(details!.errorType).toBe(QueryComplexityErrorType.PAGINATION_LIMIT_EXCEEDED);
  });

  it('returns null for non-complexity error', () => {
    const error = { message: 'other error' };
    expect(getQueryComplexityDetails(error)).toBeNull();
  });
});

describe('getQueryComplexityMessage', () => {
  it('returns depth-specific message', () => {
    const error = {
      graphQLErrors: [
        {
          message: 'too complex',
          extensions: {
            code: QueryComplexityErrorType.TOO_COMPLEX,
            maxDepth: 10,
            actualDepth: 15,
          },
        },
      ],
    };
    const message = getQueryComplexityMessage(error);
    expect(message).toContain('depth');
    expect(message).toContain('15');
    expect(message).toContain('10');
  });

  it('returns fields-specific message', () => {
    const error = {
      graphQLErrors: [
        {
          message: 'too complex',
          extensions: {
            code: QueryComplexityErrorType.TOO_COMPLEX,
            maxFields: 150,
            actualFields: 200,
          },
        },
      ],
    };
    const message = getQueryComplexityMessage(error);
    expect(message).toContain('fields');
    expect(message).toContain('200');
  });

  it('returns pagination-specific message', () => {
    const error = {
      graphQLErrors: [
        {
          message: 'pagination limit',
          extensions: {
            code: QueryComplexityErrorType.PAGINATION_LIMIT_EXCEEDED,
            maxPagination: 100,
            requestedPagination: 500,
          },
        },
      ],
    };
    const message = getQueryComplexityMessage(error);
    expect(message).toContain('500');
    expect(message).toContain('100');
  });

  it('returns default message for non-complexity error', () => {
    const message = getQueryComplexityMessage({ message: 'other' });
    expect(message).toContain('too complex');
  });
});

describe('handleQueryComplexityError', () => {
  it('returns true for complexity error', () => {
    const error = {
      graphQLErrors: [
        { extensions: { code: QueryComplexityErrorType.TOO_COMPLEX } },
      ],
    };
    expect(handleQueryComplexityError(error)).toBe(true);
  });

  it('returns false for non-complexity error', () => {
    expect(handleQueryComplexityError({ message: 'other' })).toBe(false);
  });

  it('calls retry callback for pagination limit errors', () => {
    const retry = jest.fn();
    const error = {
      graphQLErrors: [
        {
          message: 'limit',
          extensions: {
            code: QueryComplexityErrorType.PAGINATION_LIMIT_EXCEEDED,
            maxPagination: 100,
            requestedPagination: 500,
          },
        },
      ],
    };
    handleQueryComplexityError(error, retry);
    expect(retry).toHaveBeenCalled();
  });

  it('does not call retry for non-pagination errors', () => {
    const retry = jest.fn();
    const error = {
      graphQLErrors: [
        {
          message: 'complex',
          extensions: { code: QueryComplexityErrorType.TOO_COMPLEX },
        },
      ],
    };
    handleQueryComplexityError(error, retry);
    expect(retry).not.toHaveBeenCalled();
  });
});

describe('validatePaginationParams', () => {
  it('caps first at 100', () => {
    expect(validatePaginationParams({ first: 500 })).toEqual({
      first: 100,
      last: undefined,
      limit: undefined,
      take: undefined,
    });
  });

  it('caps last at 100', () => {
    expect(validatePaginationParams({ last: 200 })).toEqual({
      first: undefined,
      last: 100,
      limit: undefined,
      take: undefined,
    });
  });

  it('caps limit at 100', () => {
    expect(validatePaginationParams({ limit: 300 })).toEqual({
      first: undefined,
      last: undefined,
      limit: 100,
      take: undefined,
    });
  });

  it('caps take at 100', () => {
    expect(validatePaginationParams({ take: 150 })).toEqual({
      first: undefined,
      last: undefined,
      limit: undefined,
      take: 100,
    });
  });

  it('preserves values under 100', () => {
    expect(validatePaginationParams({ first: 50 })).toEqual({
      first: 50,
      last: undefined,
      limit: undefined,
      take: undefined,
    });
  });

  it('handles multiple params', () => {
    const result = validatePaginationParams({ first: 200, limit: 50 });
    expect(result.first).toBe(100);
    expect(result.limit).toBe(50);
  });
});
