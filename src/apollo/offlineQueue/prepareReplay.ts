/**
 * A queued write replays as the canonical mutation it was queued as, each safe
 * to send again (sous-chef-api `docs/api/offline-sync.md` § Replaying through
 * the canonical mutations). The registered operations restate what the device
 * knows better at replay; every replay counts totals on the day it runs.
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
import { localFirstFragment } from '#/apollo/utils/localFirstFields';
import { isRecord } from '#/utils/isRecord';
import { isOwnKey } from '#/utils/isOwnKey';

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

type VersionedEdit =
  | 'UpdateMealPlanItemInput'
  | 'UpdateRecipeInput'
  | 'UpdatePantryInput';

/**
 * Edits the API holds to a `version` that an earlier build queued without one,
 * by the entity each edits.
 */
const VERSIONED_EDIT_ENTITY: Record<VersionedEdit, string> = {
  UpdateMealPlanItemInput: 'MealPlanItem',
  UpdateRecipeInput: 'Recipe',
  UpdatePantryInput: 'Pantry',
};

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
  const inputType = inputTypeNameOf(mutation.mutation) ?? '';
  if (
    !isRecord(input) ||
    typeof input.version === 'number' ||
    typeof input.id !== 'string' ||
    !isOwnKey(VERSIONED_EDIT_ENTITY, inputType)
  ) {
    return variables;
  }
  const typename = VERSIONED_EDIT_ENTITY[inputType];
  const held = cache.readFragment<{ version?: number | null }>({
    id: cache.identify({ __typename: typename, id: input.id }),
    fragment: localFirstFragment(typename, 'version'),
  });
  return typeof held?.version === 'number'
    ? { ...variables, input: { ...input, version: held.version } }
    : variables;
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
