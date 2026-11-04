import type { ApolloCache } from '@apollo/client';
import { announceHouseholdLeft } from '#/apollo/refetchEvents';
import { dropHome } from './dropHome';

/**
 * Forgets a home the caller left or was removed from. Its lists, plans and
 * templates stay with the household, the caller's own included, so the app
 * resyncs what it shows. Returns the home selected in its place, or null when
 * the selection stayed.
 */
export function forgetHome(cache: ApolloCache, homeId: string): string | null {
  const next = dropHome(cache, homeId);
  announceHouseholdLeft();
  return next;
}
