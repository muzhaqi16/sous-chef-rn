import { useSyncExternalStore } from 'react';
import { isLiveChannelOpen, onLiveChannelChange } from '#/apollo/links/wsLink';

/** Whether the live-event channel is open, re-rendering when it opens or closes. */
export function useIsLiveChannelOpen(): boolean {
  return useSyncExternalStore(onLiveChannelChange, isLiveChannelOpen);
}
