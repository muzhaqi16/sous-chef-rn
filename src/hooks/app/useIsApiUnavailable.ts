import { useAppStore } from '#store/useAppStore';
import { isApiUnavailable } from '#store/slices/networkSlice';

/** True when the server can't be reached (device offline OR reachability breaker
 *  open). Reactive wrapper over the shared `isApiUnavailable` policy selector so
 *  the offline gate stays in lockstep with offlineModeLink / queueLink / the
 *  queue manager (which read the same selector). */
export const useIsApiUnavailable = (): boolean => useAppStore(isApiUnavailable);
