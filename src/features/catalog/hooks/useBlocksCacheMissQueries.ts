import { useAppStore } from '#store/useAppStore';
import { blocksCacheMissQueries } from '#store/slices/networkSlice';

/** True when a cache-missing query is answered with an offline error instead of
 *  reaching the network. Reactive wrapper over the shared
 *  `blocksCacheMissQueries` policy selector — `offlineModeLink` decides with the
 *  same selector, so a screen asking "is this blank because we never tried?"
 *  gets the link's own answer rather than a second guess at it. */
export const useBlocksCacheMissQueries = (): boolean =>
  useAppStore(blocksCacheMissQueries);
