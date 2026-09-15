import { useAppStore } from '#store/useAppStore';
import { isNetworkWithheld } from '#store/slices/networkSlice';

/** True when the server cannot be reached — the device is offline, the
 *  reachability breaker is open, or the person turned offline mode on.
 *  Reactive wrapper over `isNetworkWithheld`, the predicate `offlineModeLink`
 *  gates its short-circuit on, so a screen calls "offline" what the link did. */
export const useIsApiUnavailable = (): boolean =>
  useAppStore(isNetworkWithheld);
