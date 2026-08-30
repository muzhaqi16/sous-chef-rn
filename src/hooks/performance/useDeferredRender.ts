import { useDeferredValue } from 'react';

/**
 * `false` until React's concurrent scheduler is idle, then `true` — a gate for
 * heavy content. Uses the scheduler rather than `requestIdleCallback`, which is
 * unreliable on iOS (RN #28602). NEVER gate FlashList `data` on this.
 */
export function useDeferredRender(): boolean {
  return useDeferredValue(true, false);
}
