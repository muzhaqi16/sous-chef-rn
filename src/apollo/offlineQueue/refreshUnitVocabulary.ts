import { getApolloClient } from '#/apollo/clientRegistry';
import { useStore } from '#store';
import { logger } from '#/utils/environment';

/** Root fields that answer with `Unit` rows, and so cache retired ones. */
const UNIT_ROOT_FIELDS = [
  'units',
  'unitBySymbol',
  'searchUnits',
  'consumptionUnitsForItem',
  'restockUnitsForItem',
];

/**
 * Send the next unit lookup to the network. The Zustand copy backs the one
 * autocomplete running `localFirst`, and its stamp goes too or the empty list
 * reads fresh for 24h. Normalized `Unit` entities STAY: the retry's sync
 * builder reads the retired row for the symbol the server re-resolves from.
 */
export function refreshUnitVocabulary(): void {
  const state = useStore.getState();
  state.setCachedUnits([]);
  state.setLastUnitsFetchedAt(0);

  const cache = getApolloClient()?.cache;
  if (!cache) return;

  for (const fieldName of UNIT_ROOT_FIELDS) {
    cache.evict({ id: 'ROOT_QUERY', fieldName });
  }
  // No `gc()` here. Those evictions are the retired unit's last reference, so
  // collecting would take the row the retry reads and leave the replay
  // re-sending an id nothing can resolve.

  logger.info('♻️ Queue: unit vocabulary refreshed');
}
