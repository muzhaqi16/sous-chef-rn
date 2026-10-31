import { writeEntityFields } from '#/apollo/utils/localFirstFields';
import { isHeld } from '#/apollo/utils/writeLocalEntity';
import type { LocalWrite } from './types';

export type EntityFieldsInputs = {
  /** Absent when the cache holds no row: the server still takes the write. */
  entity?: { __typename: string; id: string };
  /** What the row shows meanwhile, in its own field names. */
  fields: Readonly<Record<string, unknown>>;
};

/**
 * A write whose local change is fields on one row. Its answer states that row,
 * so nothing is left to commit, and a refusal leaves the row as the server has it.
 */
export const entityFields: LocalWrite<EntityFieldsInputs> = {
  apply(cache, { inputs: { entity, fields } }) {
    if (entity && isHeld(cache, entity)) {
      writeEntityFields(cache, entity, fields);
    }
  },
};
