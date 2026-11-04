import type { ApolloCache } from '@apollo/client';
import { GetHomesDocument } from '#operations/home/home.generated';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
import { extractNodes } from '#/utils/connectionUtils';
import { useStore } from '#store/index';

/**
 * Takes a home off the device: its cache entry and every pick that may name
 * what it holds. Returns the home selected in its place, or null when the
 * selection stayed. The change feed calls it, so it announces nothing.
 */
export function dropHome(cache: ApolloCache, homeId: string): string | null {
  safeEvict(cache, 'Home', homeId);

  const store = useStore.getState();
  if (store.selectedHomeId !== homeId) return null;

  // The eviction may not have reached the connection's read yet.
  const [next] = extractNodes(
    cache.readQuery({ query: GetHomesDocument, optimistic: true })?.homes,
  ).filter(home => home.id !== homeId);
  const nextHomeId = next?.id ?? null;
  store.setSelectedHomeId(nextHomeId);
  store.setSelectedPantryId(null);
  store.setSelectedShoppingListId(null);
  store.setSelectedMealPlanId(null);
  return nextHomeId;
}
