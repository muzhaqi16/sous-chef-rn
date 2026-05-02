import { isNetworkError } from '../isNetworkError';

describe('isNetworkError', () => {
  it.each([
    'Network request failed',
    'Network error occurred',
    'connection refused',
    'Request timeout reached',
    'ENOTFOUND',
    'ECONNREFUSED',
    'ECONNRESET',
    'EHOSTUNREACH',
    'socket closed unexpectedly',
    'WebSocket connection lost',
    'fetch failed',
    'ws connection dropped',
    'connection lost',
    'no connection available',
    'Host unreachable',
    'unable to reach server',
    'no internet connection',
    'Device is offline',
  ])('detects "%s" as network error', message => {
    expect(isNetworkError({ message })).toBe(true);
  });

  it('detects error with networkError property', () => {
    expect(isNetworkError({ networkError: { message: 'Failed' } })).toBe(true);
  });

  it('detects networkError.message pattern', () => {
    expect(
      isNetworkError({ networkError: { message: 'Network request failed' } }),
    ).toBe(true);
  });

  it('returns false for non-network errors', () => {
    expect(isNetworkError({ message: 'Validation failed' })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isNetworkError(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isNetworkError(undefined)).toBe(false);
  });

  it('returns false for empty message', () => {
    expect(isNetworkError({ message: '' })).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isNetworkError({ message: 'NETWORK REQUEST FAILED' })).toBe(true);
  });
});
