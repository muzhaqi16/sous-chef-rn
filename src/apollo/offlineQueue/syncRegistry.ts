import type { SyncBuilderTable } from './syncBuilder';
import { PANTRY_SYNC_BUILDERS } from '#features/pantry/offline/syncBuilders';
import { SHOPPING_LIST_SYNC_BUILDERS } from '#features/shoppingList/offline/syncBuilders';

/**
 * Every feature that can replay through a `Sync*` upsert. Deliberately its own
 * list, not a manifest field: i18n iterates the static registry on the LAUNCH
 * PATH, so a manifest carrying these would pull the queue's builders into it.
 * `launchPathWeight.test.ts` holds that line.
 */
export const SYNC_REGISTRY: SyncBuilderTable = {
  ...PANTRY_SYNC_BUILDERS,
  ...SHOPPING_LIST_SYNC_BUILDERS,
};
