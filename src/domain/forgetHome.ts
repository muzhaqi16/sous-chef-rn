import type { ApolloCache } from '@apollo/client';
import { announceHouseholdLeft } from '#/apollo/refetchEvents';
import { dropHome } from './dropHome';

/**
 * Forgets a home the caller left, deleted or was removed from. What it held
 * may have moved or gone, so the app resyncs what it shows. Returns the home
 * selected in its place, or null when the selection stayed.
 */
export function forgetHome(cache: ApolloCache, homeId: string): string | null {
  const next = dropHome(cache, homeId);
  announceHouseholdLeft();
  return next;
}
