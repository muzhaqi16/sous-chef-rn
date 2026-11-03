import {
  isQueryComplexityError,
  getQueryComplexityDetails,
  describeQueryComplexity,
  QueryComplexityErrorType,
} from '../queryComplexity';

describe('isQueryComplexityError', () => {
  it('returns true for graphQLErrors with PAGINATION_LIMIT_EXCEEDED code', () => {
    const error = {
      graphQLErrors: [
        {
          extensions: {
            code: QueryComplexityErrorType.PAGINATION_LIMIT_EXCEEDED,
          },
        },
      ],
    };
    expect(isQueryComplexityError(error)).toBe(true);
  });

  it('returns true for error with extensions directly', () => {
    const error = {
      extensions: { code: QueryComplexityErrorType.PAGINATION_LIMIT_EXCEEDED },
    };
    expect(isQueryComplexityError(error)).toBe(true);
  });

  it('returns false for unrelated error', () => {
    const error = {
      graphQLErrors: [{ extensions: { code: 'UNAUTHENTICATED' } }],
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
          message: 'Pagination limit',
          extensions: {
            code: QueryComplexityErrorType.PAGINATION_LIMIT_EXCEEDED,
            maxPagination: 100,
            requestedPagination: 500,
          },
        },
      ],
    };
    const details = getQueryComplexityDetails(error);
    expect(details).not.toBeNull();
    expect(details!.errorType).toBe(
      QueryComplexityErrorType.PAGINATION_LIMIT_EXCEEDED,
    );
    expect(details!.maxPagination).toBe(100);
    expect(details!.requestedPagination).toBe(500);
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
    expect(details!.errorType).toBe(
      QueryComplexityErrorType.PAGINATION_LIMIT_EXCEEDED,
    );
  });

  it('returns null for non-complexity error', () => {
    const error = { message: 'other error' };
    expect(getQueryComplexityDetails(error)).toBeNull();
  });
});

describe('describeQueryComplexity', () => {
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
    const message = describeQueryComplexity(error);
    expect(message).toContain('500');
    expect(message).toContain('100');
  });

  it('returns default message for non-complexity error', () => {
    const message = describeQueryComplexity({ message: 'other' });
    expect(message).toContain('fewer items');
  });
});
