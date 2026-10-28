import type { ApolloCache } from '@apollo/client';
import { GetHomesDocument } from '#operations/home/home.generated';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
import { announceHouseholdLeft } from '#/apollo/refetchEvents';
import { extractNodes } from '#/utils/connectionUtils';
import { useStore } from '#store/index';

/**
 * Forget a home the caller left or was removed from: its cache entry, and
 * every pick that may name what it holds. Its lists, plans and templates stay
 * with the household, their creator's included, so the app resyncs what it
 * shows.
 *
 * Returns the home now selected in its place, or null when the selection did
 * not move to another one.
 */
export function forgetHome(cache: ApolloCache, homeId: string): string | null {
  safeEvict(cache, 'Home', homeId);
  announceHouseholdLeft();

  const store = useStore.getState();
  if (store.selectedHomeId !== homeId) return null;

  // The eviction may not have reached the connection's read yet.
  const [next] = extractNodes(
    cache.readQuery({ query: GetHomesDocument })?.homes,
  ).filter(home => home.id !== homeId);
  const nextHomeId = next?.id ?? null;
  store.setSelectedHomeId(nextHomeId);
  store.setSelectedPantryId(null);
  store.setSelectedShoppingListId(null);
  store.setSelectedMealPlanId(null);
  return nextHomeId;
}
