/**
 * Every feature that settles its own replay, keyed by the operation its
 * document declares. See {@link REPLAY_PREPARATIONS} for why this is a list
 * rather than a manifest field.
 */
import { byOperation } from '#apollo/utils/documentOperation';
import {
  FEATURE_GONE_REPLAYS,
  FEATURE_MERGE_REPORTERS,
  FEATURE_QUANTITY_OVERWRITES,
  FEATURE_SETTLED_REPLAYS,
} from '#features/registry.data';
import type { ReplayReconcilerTable } from './types';

export const MERGE_REPORTERS: ReplayReconcilerTable = byOperation(
  FEATURE_MERGE_REPORTERS,
);

export const REPLAY_RECONCILERS: ReplayReconcilerTable = {
  ...MERGE_REPORTERS,
  ...byOperation(FEATURE_SETTLED_REPLAYS),
};

export const GONE_REPLAYS: ReplayReconcilerTable =
  byOperation(FEATURE_GONE_REPLAYS);

export const MERGED_QUANTITY_OVERWRITES: Record<
  string,
  (input: Record<string, unknown>) => boolean
> = byOperation(FEATURE_QUANTITY_OVERWRITES);
