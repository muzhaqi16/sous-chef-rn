import type { ApolloCache } from '@apollo/client';
import { GetHomesDocument } from '#operations/home/home.generated';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
import { announceHouseholdLeft } from '#/apollo/refetchEvents';
import { extractNodes } from '#/utils/connectionUtils';
import { useStore } from '#store/index';

/**
 * Forgets a home the caller left or was removed from: its cache entry and every
 * pick that may name what it holds. Its lists, plans and templates stay with
 * the household, the caller's own included, so the app resyncs what it shows.
 * Returns the home selected in its place, or null when the selection stayed.
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
