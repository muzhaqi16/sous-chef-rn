import { pickFresherSessionTokens } from '../sessionTokens';

describe('pickFresherSessionTokens', () => {
  // Minimal unsigned JWT carrying just the `iat` claim jwt-decode reads.
  const tokenWithIat = (iat: number): string => {
    const payload = Buffer.from(JSON.stringify({ iat })).toString('base64url');
    return `header.${payload}.signature`;
  };
  const pair = (iat: number) => ({
    accessToken: `access-${iat}`,
    refreshToken: tokenWithIat(iat),
  });

  it('returns primary when there is no fallback', () => {
    const primary = pair(100);
    expect(pickFresherSessionTokens(primary, null)).toBe(primary);
  });

  it('returns the fallback when its refresh token is newer', () => {
    const primary = pair(100);
    const fallback = pair(200);
    expect(pickFresherSessionTokens(primary, fallback)).toBe(fallback);
  });

  it('returns primary when the fallback refresh token is older', () => {
    const primary = pair(200);
    const fallback = pair(100);
    expect(pickFresherSessionTokens(primary, fallback)).toBe(primary);
  });

  it('favors primary on an equal issue time', () => {
    const primary = pair(100);
    const fallback = pair(100);
    expect(pickFresherSessionTokens(primary, fallback)).toBe(primary);
  });

  it('favors primary when the fallback token is undecodable', () => {
    const primary = pair(100);
    const fallback = {
      accessToken: 'access-bad',
      refreshToken: 'not-a-jwt',
    };
    expect(pickFresherSessionTokens(primary, fallback)).toBe(primary);
  });
});
