import { jwtDecode } from 'jwt-decode';
import type { SessionTokens } from '#platform/ports';

/** Issue time (`iat`, seconds) of a refresh-token JWT; 0 when undecodable. */
const refreshTokenIssuedAt = (refreshToken: string): number => {
  try {
    const { iat } = jwtDecode<{ iat?: number }>(refreshToken);
    return typeof iat === 'number' ? iat : 0;
  } catch {
    return 0;
  }
};

/**
 * The fresher of two token pairs, by refresh-token issue time. A failed secure
 * store write can strand an already-rotated pair there while device storage
 * holds the newer one, and restoring the stale pair 401s into a logout. Ties
 * favour `primary`.
 */
export const pickFresherSessionTokens = (
  primary: SessionTokens,
  fallback: SessionTokens | null,
): SessionTokens => {
  if (!fallback) return primary;
  return refreshTokenIssuedAt(fallback.refreshToken) >
    refreshTokenIssuedAt(primary.refreshToken)
    ? fallback
    : primary;
};
