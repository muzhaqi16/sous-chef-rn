/**
 * A queued write replays as the document it was queued as: the API's canonical
 * mutations are safe to send again. What a replay restates is only what the
 * device knows better by then, such as a unit the vocabulary repair retired.
 * Each feature owns its preparers under its own `offline/`.
 */
import type { ApolloCache, OperationVariables } from '@apollo/client';
import type { QueuedMutation, ReplayInputs } from './types';
import { firstNonBlank } from '#/utils/firstNonBlank';
import { isRecord } from '#/utils/isRecord';
import { ReplayPreparation_UnitFragmentDoc } from './replayPreparation.generated';

export interface ReplayContext {
  cache: ApolloCache;
  /** Whether this attempt follows a refusal naming a retired unit. */
  unitsRefreshed: boolean;
  /** The id the server now gives a unit symbol. */
  unitIdForSymbol: (symbol: string) => Promise<string | undefined>;
}

export type ReplayPreparer = (
  mutation: QueuedMutation,
  context: ReplayContext,
) => Promise<OperationVariables>;

type Input = Record<string, unknown>;

/** The unit ids a queued input names: `unit.id`, a flat `unitId`, and per line. */
function unitIdsOf(input: Input): string[] {
  const own = [isRecord(input.unit) ? input.unit.id : undefined, input.unitId];
  const lines = Array.isArray(input.items) ? (input.items as unknown[]) : [];
  const perLine = lines.map(line =>
    isRecord(line) && isRecord(line.unit) ? line.unit.id : undefined,
  );
  return [...own, ...perLine].filter(
    (id): id is string => typeof id === 'string' && id !== '',
  );
}

const capturedSymbolKey = (unitId: string) => `unit:${unitId}`;

/** The cached symbol of a unit id. */
export function readUnitSymbol(
  cache: ApolloCache,
  unitId: string,
): string | undefined {
  const unit = cache.readFragment({
    id: cache.identify({ __typename: 'Unit', id: unitId }),
    fragment: ReplayPreparation_UnitFragmentDoc,
  });
  return firstNonBlank(unit?.symbol);
}

/**
 * The symbol of every unit the write names, read when it is queued: the replay
 * may run after the row has left the cache.
 */
export function captureUnitSymbols(
  mutation: QueuedMutation,
  cache: ApolloCache,
): ReplayInputs {
  const input: unknown = mutation.variables.input;
  if (!isRecord(input)) return {};
  const entries = unitIdsOf(input).flatMap(id => {
    const symbol = readUnitSymbol(cache, id);
    return symbol ? [[capturedSymbolKey(id), symbol]] : [];
  });
  return Object.fromEntries(entries) as ReplayInputs;
}

const symbolFor = (
  mutation: QueuedMutation,
  cache: ApolloCache,
  unitId: string,
): string | undefined =>
  mutation.replayInputs?.[capturedSymbolKey(unitId)] ??
  // An entry queued by an older build captured one unnamed symbol.
  mutation.replayInputs?.unitSymbol ??
  readUnitSymbol(cache, unitId);

/**
 * A `UnitRefInput` naming its unit by symbol where one is known: an id the
 * vocabulary repair retired cannot be re-resolved, a symbol can. `@oneOf`, so
 * the symbol replaces the id.
 */
function bySymbol(
  mutation: QueuedMutation,
  cache: ApolloCache,
  ref: unknown,
): unknown {
  if (!isRecord(ref) || typeof ref.id !== 'string') return ref;
  const symbol = symbolFor(mutation, cache, ref.id);
  return symbol ? { symbol } : ref;
}

/**
 * A single row's unit keeps the id it captured a symbol for until a refusal
 * names that id retired: the service creates a counting unit for a symbol it
 * does not know, so sending the symbol first can turn a renamed unit into a
 * stray one.
 */
function rowUnitRef(
  mutation: QueuedMutation,
  { cache, unitsRefreshed }: ReplayContext,
  ref: unknown,
): unknown {
  const holdsId =
    !unitsRefreshed &&
    isRecord(ref) &&
    typeof ref.id === 'string' &&
    mutation.replayInputs?.[capturedSymbolKey(ref.id)] !== undefined;
  return holdsId ? ref : bySymbol(mutation, cache, ref);
}

/**
 * The input with each unit restated for the server as it stands. A batch
 * line goes by symbol on every attempt: its refusal does not say which
 * reference failed, so waiting for one would lose the line. A flat `unitId`
 * (which takes no symbol) is re-resolved to the unit's current id once a
 * refusal has named it retired.
 */
export async function withCurrentUnits(
  mutation: QueuedMutation,
  context: ReplayContext,
): Promise<OperationVariables> {
  const { cache, unitsRefreshed, unitIdForSymbol } = context;
  const { variables } = mutation;
  const input: unknown = variables.input;
  if (!isRecord(input)) return variables;

  const next: Input = { ...input };
  if ('unit' in input) next.unit = rowUnitRef(mutation, context, input.unit);
  if (Array.isArray(input.items)) {
    next.items = (input.items as unknown[]).map(line =>
      isRecord(line) && 'unit' in line
        ? { ...line, unit: bySymbol(mutation, cache, line.unit) }
        : line,
    );
  }
  if (unitsRefreshed && typeof input.unitId === 'string') {
    const symbol = symbolFor(mutation, cache, input.unitId);
    const current = symbol ? await unitIdForSymbol(symbol) : undefined;
    if (current) next.unitId = current;
  }
  return { ...variables, input: next };
}

/** Replays the write exactly as queued. */
export const asQueued: ReplayPreparer = mutation =>
  Promise.resolve(mutation.variables);
