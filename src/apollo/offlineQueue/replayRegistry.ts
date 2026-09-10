/**
 * Every feature that settles its own replay. See {@link SYNC_REGISTRY} for why
 * this is a list here rather than a manifest field.
 */
import { HOME_REPLAY_RECONCILERS } from '#features/home/offline/replayReconcilers';
import { PANTRY_REPLAY_RECONCILERS } from '#features/pantry/offline/replayReconcilers';
import type { ReplayReconcilerTable } from './types';

export const REPLAY_RECONCILERS: ReplayReconcilerTable = {
  ...HOME_REPLAY_RECONCILERS,
  ...PANTRY_REPLAY_RECONCILERS,
};
