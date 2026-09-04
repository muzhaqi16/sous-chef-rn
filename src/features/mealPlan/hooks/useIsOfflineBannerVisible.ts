import { useAppStore } from '#store/useAppStore';

/**
 * Whether to tell the user the server can't be reached. Reads the DEBOUNCED
 * `offlineBannerCause`, not the raw flags — `isApiUnavailable` flips on a single
 * failed request, which is right for policy but flashes on screen.
 */
export const useIsOfflineBannerVisible = (): boolean =>
  useAppStore(state => state.offlineBannerCause !== null);
