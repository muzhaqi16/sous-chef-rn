import { byOperation } from '#apollo/utils/documentOperation';
import { FEATURE_REPLAY_PREPARATIONS } from '#features/registry.data';
import type { ReplayPreparer } from './replayPreparation';

/**
 * Operations the queue replays without a `localFirst` opt-in, with what each
 * restates. Not a manifest field: i18n iterates the static registry on the
 * LAUNCH PATH, which would pull these in (`launchPathWeight.test.ts`).
 */
export const REPLAY_PREPARATIONS: Readonly<Record<string, ReplayPreparer>> =
  byOperation(FEATURE_REPLAY_PREPARATIONS);
