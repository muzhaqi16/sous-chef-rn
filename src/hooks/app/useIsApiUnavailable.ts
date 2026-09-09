import { useAppStore } from '#store/useAppStore';
import { isApiUnavailable } from '#store/slices/networkSlice';

/** True when the server cannot be reached — the device is offline, the
 *  reachability breaker is open, or the person turned offline mode on.
 *  Reactive wrapper over the shared `isApiUnavailable` policy selector, so a
 *  screen, the offline banner, `offlineModeLink` and `queueLink` all answer
 *  "can we reach the server?" the same way. */
export const useIsApiUnavailable = (): boolean => useAppStore(isApiUnavailable);
