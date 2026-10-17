/**
 * A queued write replays as its canonical mutation, safe to send again
 * (sous-chef-api `docs/api/offline-sync.md`); registered operations restate what
 * the device knows better at replay, and totals count on the day it runs.
 */
import { Kind } from 'graphql';
import type { ApolloCache, OperationVariables } from '@apollo/client';
import { REPLAY_PREPARATIONS } from './preparationRegistry';
import {
  asQueued,
  captureUnitSymbols,
  type ReplayContext,
} from './replayPreparation';
import type { QueuedMutation, ReplayInputs } from './types';
import { todayKey } from '#/utils/dateUtils';
import { inputTypeNameOf } from '#/apollo/utils/documentOperation';
import { cachedVersion } from '#/apollo/utils/entityWriteChain';
import { isRecord } from '#/utils/isRecord';
import { subjectTypeOf } from './queuedSubject';

/**
 * queueLink's "replay-safe without an explicit `context.localFirst` opt-in"
 * half of the allowlist.
 */
export function hasReplayPreparation(operationName: string): boolean {
  return REPLAY_PREPARATIONS[operationName] != null;
}

/**
 * The cache values a registered write's replay will read, taken while its row
 * is still cached. Undefined when there are none.
 */
export function captureReplayInputs(
  mutation: QueuedMutation,
  cache: ApolloCache,
): ReplayInputs | undefined {
  if (!hasReplayPreparation(mutation.operationName)) return undefined;
  const inputs = captureUnitSymbols(mutation, cache);
  return Object.keys(inputs).length > 0 ? inputs : undefined;
}

/** The variables a queued write replays with, against its own document. */
export async function prepareReplay(
  mutation: QueuedMutation,
  context: ReplayContext,
): Promise<OperationVariables> {
  const prepare = REPLAY_PREPARATIONS[mutation.operationName] ?? asQueued;
  return withReplayDay(
    mutation,
    withStatedVersion(mutation, await prepare(mutation, context), context),
  );
}

/** Edits the API holds to a `version` that an earlier build queued without one. */
const VERSIONED_EDITS: ReadonlySet<string> = new Set([
  'UpdateMealPlanItemInput',
  'UpdateRecipeInput',
  'UpdatePantryInput',
]);

/**
 * States the version the cache holds on an edit stored without one. With no
 * cached row the input is left as it is: the API refuses it, and the write is
 * withdrawn through the reported path.
 */
function withStatedVersion(
  mutation: QueuedMutation,
  variables: OperationVariables,
  { cache }: ReplayContext,
): OperationVariables {
  const input: unknown = variables.input;
  const typename = subjectTypeOf(mutation);
  if (
    !isRecord(input) ||
    typeof input.version === 'number' ||
    typeof input.id !== 'string' ||
    !typename ||
    !VERSIONED_EDITS.has(inputTypeNameOf(mutation.mutation) ?? '')
  ) {
    return variables;
  }
  const id = cache.identify({ __typename: typename, id: input.id });
  const version = id ? cachedVersion(cache, id, typename) : undefined;
  return version === undefined
    ? variables
    : { ...variables, input: { ...input, version } };
}

/**
 * `$today` only dates what the response reads back (`Pantry.stats`), so a
 * replay counts on the day it runs, whatever day it was queued.
 */
function withReplayDay(
  mutation: QueuedMutation,
  variables: OperationVariables,
): OperationVariables {
  const declares = mutation.mutation.definitions.some(
    definition =>
      definition.kind === Kind.OPERATION_DEFINITION &&
      definition.variableDefinitions?.some(
        variable => variable.variable.name.value === 'today',
      ),
  );
  return declares ? { ...variables, today: todayKey() } : variables;
}
