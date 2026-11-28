import {
  withCurrentUnits,
  type ReplayPreparer,
} from '#apollo/offlineQueue/replayPreparation';
import { isRecord } from '#utils/isRecord';

/**
 * A queued create replays with `forceAdd`: a stack for the same item and unit
 * that another member added while it sat queued absorbs it under its own id
 * (adopted by `reconcileCreatePantryItemReplay`) rather than refusing it as a
 * duplicate.
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

/**
 * A refused stock check the person retries applies to each stack as it is now:
 * the API takes an entry with no `expectedVersion` that way. Replayed on its
 * own, it keeps the version the household saw.
 */
export const retryStockCheckAsItStands: ReplayPreparer = ({
  variables,
  overwrites,
}) => {
  const input: unknown = variables.input;
  if (!overwrites || !isRecord(input) || !Array.isArray(input.entries)) {
    return Promise.resolve(variables);
  }
  const entries = input.entries.map((entry: unknown) => {
    if (!isRecord(entry)) return entry;
    const { expectedVersion: _seen, ...asItStands } = entry;
    return asItStands;
  });
  return Promise.resolve({ ...variables, input: { ...input, entries } });
};
