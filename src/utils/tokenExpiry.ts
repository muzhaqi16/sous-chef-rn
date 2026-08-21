import { jwtDecode } from 'jwt-decode';

/**
 * Is this JWT past its `exp`, or within `bufferMs` of it?
 *
 * A token that cannot be decoded is reported as expiring: refreshing one we
 * cannot read beats presenting it.
 *
 * Two callers, and they ask with different buffers: `authLink` five minutes
 * early, so a request never races the expiry, and `isRefreshTokenValid` with
 * none at all, since it only wants to know whether the refresh token is already
 * dead.
 *
 * `tokenScheduler` decodes the token itself rather than calling this — it needs
 * the expiry instant to schedule against, not a boolean — and the WebSocket
 * never asks: it sends the refresh token in `connectionParams` and lets the
 * server decide whether to spend it.
 */
export const isTokenExpiringSoon = (token: string, bufferMs = 0): boolean => {
  try {
    const { exp } = jwtDecode<{ exp: number }>(token);
    return Date.now() > exp * 1000 - bufferMs;
  } catch {
    return true;
  }
};
