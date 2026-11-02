import { useAppStore } from '#store/useAppStore';
import { isApiUnavailable } from '#store/slices/networkSlice';

/** True when the server cannot be reached: the device is offline or the
 *  reachability breaker is open. The one offline decision for features, reactive
 *  over the predicate `offlineReadLink` gates on, so a screen calls "offline"
 *  what the link did. */
export const useIsApiUnavailable = (): boolean => useAppStore(isApiUnavailable);
