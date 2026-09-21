import { useEffect } from 'react';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { drainPendingRevocations } from '#/services/auth/refreshTokenRevocation';

/**
 * Revokes the sessions that ended while the API was out of reach, on launch
 * and whenever it becomes reachable again.
 */
export function usePendingRevocationDrain(): void {
  const isApiUnavailable = useIsApiUnavailable();

  // Called even while unavailable (it no-ops then): under `inlineRequires` this
  // first call is what loads the module that registers the session-end revoke.
  useEffect(() => {
    void drainPendingRevocations();
  }, [isApiUnavailable]);
}
