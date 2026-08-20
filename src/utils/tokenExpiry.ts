import { jwtDecode } from 'jwt-decode';

/**
 * Is this JWT past its `exp`, or within `bufferMs` of it?
 *
 * A token that cannot be decoded is reported as expiring: refreshing one we
 * cannot read beats presenting it.
 *
 * The buffer differs per caller — the auth link asks five minutes early so a
 * request never races the expiry, the scheduler ten to absorb wake-up latency,
 * and the socket with none at all, since it only wants to know whether the token
 * it is about to present is already dead.
 */
export const isTokenExpiringSoon = (token: string, bufferMs = 0): boolean => {
  try {
    const { exp } = jwtDecode<{ exp: number }>(token);
    return Date.now() > exp * 1000 - bufferMs;
  } catch {
    return true;
  }
};
