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
  return withReplayDay(mutation, await prepare(mutation, context));
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
