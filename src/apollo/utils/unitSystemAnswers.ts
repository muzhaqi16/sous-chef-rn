import type { ApolloCache, ApolloClient } from '@apollo/client';
import type { Query } from '#/graphql/generated/schemaTypes';
import {
  entityFields,
  type EntityFieldsInputs,
} from '#/apollo/pendingWrites/entityFields';
import type { LocalWrite } from '#/apollo/pendingWrites/types';
import { GetUserSettingsDocument } from '#operations/auth/user.generated';
import { isRecord } from '#/utils/isRecord';
import { logger } from '#/utils/environment';

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
 * Re-reads what SYSTEM means on this device once its locale changes, written
 * over the cached answer: evicting it would leave every settings read
 * incomplete, and amounts in metric, until the answer landed.
 */
export async function refreshDeviceUnitSystem(
  client: ApolloClient,
): Promise<void> {
  try {
    const { error } = await client.query({
      query: GetUserSettingsDocument,
      fetchPolicy: 'network-only',
    });
    if (error) logger.warn('Device unit system re-read failed:', error);
  } catch (error) {
    logger.warn('Device unit system re-read failed:', error);
  }
}

/** A settings write: one that set the unit system outdates those answers. */
export const settingsFields: LocalWrite<EntityFieldsInputs> = {
  ...entityFields,
  commit(cache, { variables }) {
    const input: unknown = variables.input;
    if (
      isRecord(input) &&
      isRecord(input.regional) &&
      input.regional.preferredUnitSystem !== undefined
    ) {
      dropUnitSystemAnswers(cache);
    }
  },
};
