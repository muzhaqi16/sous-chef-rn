import type { LocalWriteTable } from './types';

/**
 * Every feature's local writes, keyed by the operation its document declares.
 * See {@link REPLAY_PREPARATIONS} for why this is a list here rather than a
 * manifest field.
 */
export const LOCAL_WRITES: LocalWriteTable = {};
