import { GraphQLDomainError, GraphQLNetworkError } from '../graphqlErrors';

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
