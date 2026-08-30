import { jwtDecode } from 'jwt-decode';

/**
 * Is this JWT past its `exp`, or within `bufferMs` of it? An undecodable token
 * counts as expiring — refreshing one we cannot read beats presenting it.
 * Callers pick their own buffer: `authLink` five minutes, `isRefreshTokenValid`
 * none, since it only asks whether the refresh token is already dead.
 */
export const isTokenExpiringSoon = (token: string, bufferMs = 0): boolean => {
  try {
    const { exp } = jwtDecode<{ exp: number }>(token);
    return Date.now() > exp * 1000 - bufferMs;
  } catch {
    return true;
  }
};
