import type { ApolloCache } from '@apollo/client';
import type { Query } from '#/graphql/generated/schemaTypes';
import type { ReplayReconciler } from '#/apollo/offlineQueue/types';
import { GetUserSettingsDocument } from '#operations/auth/user.generated';
import { isRecord } from '#/utils/isRecord';

/**
 * The root fields the server answers in the caller's unit system (see
 * `UnitSystem`): a picker withholds a weight or volume outside it.
 */
const IN_CALLERS_UNIT_SYSTEM = [
  'consumptionUnitsForPantryItem',
  'restockUnitsForPantryItem',
] satisfies ReadonlyArray<keyof Query>;

/**
 * Drops them once the caller's unit system may have changed — the setting, or
 * the device locale "Device default" reads — so each is asked again when next
 * read. Converted amounts stay: their screens re-query on mount, and dropping
 * one leaves a recipe unreadable offline.
 */
export function dropUnitSystemAnswers(cache: ApolloCache): void {
  for (const fieldName of IN_CALLERS_UNIT_SYSTEM) {
    cache.evict({ id: 'ROOT_QUERY', fieldName });
  }
  cache.gc();
}

/**
 * Drops what SYSTEM meant on this device once its locale changes, so the
 * settings read asks again and amounts follow the new locale.
 */
export function dropDeviceUnitSystem(cache: ApolloCache): void {
  const settings = cache.readQuery({ query: GetUserSettingsDocument })?.me
    ?.settings;
  if (!settings) return;
  cache.evict({ id: cache.identify(settings), fieldName: 'deviceUnitSystem' });
}

/** A settings write replayed from the queue that set the unit system. */
export const reconcileSettingsReplay: ReplayReconciler = (cache, variables) => {
  const input: unknown = variables.input;
  if (
    isRecord(input) &&
    isRecord(input.regional) &&
    input.regional.preferredUnitSystem !== undefined
  ) {
    dropUnitSystemAnswers(cache);
  }
};
