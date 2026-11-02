import type { DataState } from '#hooks/data/useDataState';

/**
 * What keeps setup from deciding what to create, or null once it can: with no
 * home an invitation may be the answer, so it has to be known too.
 */
export function unreadAccountState(
  readState: DataState,
  hasHome: boolean,
  invitesState: DataState,
): 'error' | 'offline' | null {
  if (readState === 'error' || readState === 'offline') return readState;
  if (hasHome) return null;
  return invitesState === 'error' || invitesState === 'offline'
    ? invitesState
    : null;
}
