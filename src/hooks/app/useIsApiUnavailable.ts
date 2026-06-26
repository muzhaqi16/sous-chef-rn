import { useAppStore, useIsOnline } from '#store/useAppStore';

/** True when the server can't be reached (device offline OR reachability breaker open). */
export const useIsApiUnavailable = (): boolean => {
  const isOnline = useIsOnline();
  const apiReachable = useAppStore(state => state.apiReachable);
  return !isOnline || apiReachable === false;
};
