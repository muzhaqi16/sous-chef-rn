import type { FormattedExecutionResult } from 'graphql';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import {
  GraphQLDomainError,
  GraphQLNetworkError,
  getTopLevelGraphQLError,
  isResourceAccessLostError,
} from '../graphqlErrors';

describe('GraphQLDomainError', () => {
  const payload = {
    __typename: 'ValidationError',
    code: 'VALIDATION_FAILED',
    message: 'Name is required',
    field: 'name',
  };

  it('extends Error', () => {
    const error = new GraphQLDomainError(payload);
    expect(error).toBeInstanceOf(Error);
  });

  it('preserves __typename, code, and message', () => {
    const error = new GraphQLDomainError(payload);
    expect(error.message).toBe('Name is required');
    expect(error.__typename).toBe('ValidationError');
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.name).toBe('GraphQLDomainError');
  });

  it('preserves full payload including extra fields', () => {
    const error = new GraphQLDomainError(payload);
    expect(error.payload).toEqual(payload);
    expect((error.payload as typeof payload).field).toBe('name');
  });
});

describe('GraphQLNetworkError', () => {
  it('extends Error', () => {
    const error = new GraphQLNetworkError('No payload returned');
    expect(error).toBeInstanceOf(Error);
  });

  it('uses the fallback message', () => {
    const error = new GraphQLNetworkError('Failed to create item');
    expect(error.message).toBe('Failed to create item');
    expect(error.name).toBe('GraphQLNetworkError');
  });
});

describe('getTopLevelGraphQLError', () => {
  it('reads the first error code + message from CombinedGraphQLErrors', () => {
    const error = new CombinedGraphQLErrors({
      errors: [
        { message: 'Token expired', extensions: { code: 'UNAUTHENTICATED' } },
        { message: 'Second', extensions: { code: 'OTHER' } },
      ],
    } satisfies FormattedExecutionResult);

    expect(getTopLevelGraphQLError(error)).toEqual({
      code: 'UNAUTHENTICATED',
      message: 'Token expired',
    });
  });

  it('defaults code/message to empty strings when missing', () => {
    const error = new CombinedGraphQLErrors({
      errors: [{ message: '' }],
    } satisfies FormattedExecutionResult);
    expect(getTopLevelGraphQLError(error)).toEqual({ code: '', message: '' });
  });

  it('returns null for a non-GraphQL error', () => {
    expect(getTopLevelGraphQLError(new Error('network'))).toBeNull();
    expect(getTopLevelGraphQLError(undefined)).toBeNull();
    expect(getTopLevelGraphQLError(null)).toBeNull();
  });
});

describe('isResourceAccessLostError', () => {
  const errorWithCode = (code: string) =>
    new CombinedGraphQLErrors({
      errors: [{ message: 'denied', extensions: { code } }],
    } satisfies FormattedExecutionResult);

  it('is true for FORBIDDEN', () => {
    expect(isResourceAccessLostError(errorWithCode('FORBIDDEN'))).toBe(true);
  });

  // Retired server-side and emitted by nothing — matching it would keep a dead
  // code alive in the access-revoked path.
  it('is false for the retired AUTHZ_FORBIDDEN', () => {
    expect(isResourceAccessLostError(errorWithCode('AUTHZ_FORBIDDEN'))).toBe(
      false,
    );
  });

  it('is false for unrelated GraphQL error codes', () => {
    expect(isResourceAccessLostError(errorWithCode('VALIDATION_FAILED'))).toBe(
      false,
    );
    expect(isResourceAccessLostError(errorWithCode('UNAUTHENTICATED'))).toBe(
      false,
    );
  });

  it('is false for RESOURCE_NOT_FOUND — by-id misses are now null data, not an error', () => {
    expect(isResourceAccessLostError(errorWithCode('RESOURCE_NOT_FOUND'))).toBe(
      false,
    );
  });

  it('is false for network/non-GraphQL errors (no eviction when offline)', () => {
    expect(isResourceAccessLostError(new Error('network'))).toBe(false);
    expect(isResourceAccessLostError(undefined)).toBe(false);
    expect(isResourceAccessLostError(null)).toBe(false);
  });
});
