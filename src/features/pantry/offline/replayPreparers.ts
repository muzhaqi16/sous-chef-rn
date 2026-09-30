import {
  withCurrentUnits,
  type ReplayPreparer,
} from '#/apollo/offlineQueue/replayPreparation';
import { isRecord } from '#/utils/isRecord';

/**
 * A queued create replays with `forceAdd`: a stack for the same item and unit
 * that another member added while it sat queued absorbs it under its own id
 * (`outcome: MERGED`, adopted by `reconcileCreatePantryItemReplay`) rather than
 * refusing it as a duplicate.
 */
export const preparePantryItemCreate: ReplayPreparer = async (
  mutation,
  context,
) => {
  const variables = await withCurrentUnits(mutation, context);
  const input: unknown = variables.input;
  return isRecord(input)
    ? { ...variables, input: { ...input, forceAdd: true } }
    : variables;
};
