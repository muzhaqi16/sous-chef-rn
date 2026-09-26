import type { DocumentNode } from 'graphql';
import { gql, type ApolloCache } from '@apollo/client';
import type { BrandRefInput } from '#/graphql/generated/schemaTypes';
import type { QueuedMutation, ReplayInputs } from './types';
import { queuedSubject } from './queuedSubject';
import { firstNonBlank } from '#/utils/firstNonBlank';

/**
 * The contract between the queue and the features whose writes it replays: the
 * kernel owns these shapes, each feature owns its builders under its own
 * `offline/`. A builder takes the cache, not pre-bound readers, so a feature's
 * backfill fragment lives beside it rather than in the queue manager.
 */
export interface SyncConversion {
  syncMutation: DocumentNode;
  syncVariables: Record<string, unknown>;
  /** Replays an original document whose input's `version` is non-null. */
  requiresVersion?: boolean;
}

export type ReplayInputReader = (
  mutation: QueuedMutation,
  cache: ApolloCache,
) => ReplayInputs;

export type SyncBuilder = ((
  mutation: QueuedMutation,
  cache: ApolloCache,
) => SyncConversion) & {
  /** Run when the write is queued; its result is stored as `replayInputs`. */
  captureReplayInputs?: ReplayInputReader;
};

/**
 * A builder whose cache reads are all in `read`. Values captured at enqueue win
 * over a replay-time read, which only fills what an older entry lacks.
 */
export function withCapturedReads(
  read: ReplayInputReader,
  build: (
    mutation: QueuedMutation,
    inputs: ReplayInputs,
    cache: ApolloCache,
  ) => SyncConversion,
): SyncBuilder {
  const builder: SyncBuilder = (mutation, cache) =>
    build(
      mutation,
      { ...read(mutation, cache), ...mutation.replayInputs },
      cache,
    );
  builder.captureReplayInputs = read;
  return builder;
}

/** Drops the reads that found nothing, so a stored miss never masks a hit. */
export const definedInputs = (
  inputs: Record<string, string | null | undefined>,
): ReplayInputs =>
  Object.fromEntries(
    Object.entries(inputs).filter(
      (entry): entry is [string, string] => entry[1] != null,
    ),
  );

/** op-name → builder, the shape a feature's `offline/syncBuilders.ts` exports. */
export type SyncBuilderTable = Record<string, SyncBuilder>;

/**
 * Loose shape of a queued `input`, persisted untyped. The quantity ops send the
 * unit as a flat `unitId` rather than a `unit` reference; the builders
 * normalize both.
 */
export interface QueuedInput {
  id?: string;
  itemId?: string;
  pantryItemId?: string;
  version?: number;
  shoppingListId?: string;
  pantryId?: string;
  itemName?: string;
  category?: string;
  notes?: string;
  quantity?: number | string;
  unit?: UnitSpec | null;
  unitLabel?: string | null;
  // `legacyRefs` rewrites an older build's brandId/brandName to this before replay.
  brand?: BrandRefInput | null;
  unitId?: string;
  purchased?: boolean;
  purchaseTracking?: Record<string, unknown>;
  priority?: number;
  sortOrder?: string;
  afterItemId?: string;
  beforeItemId?: string;
  item?: Record<string, unknown>;
  // Single-add ops send the batch AddItemsToShoppingListInput shape, so the
  // shopping builder flattens items[0] to read batch and flat inputs alike.
  items?: QueuedInput[];
  [key: string]: unknown;
}

export const getQueuedInput = (mutation: QueuedMutation): QueuedInput =>
  (mutation.variables.input ?? {}) as QueuedInput;

/**
 * The client-minted permanent cuid IS the sync `clientId`, read from the input
 * type's subject — never a guess that could land on a catalog `itemId`. A
 * malformed input with no id yields `undefined`, so the server refuses it;
 * builders cast to `Sync*Input`'s required `clientId: ID`, which does not coerce.
 */
export const getClientId = (mutation: QueuedMutation): string | undefined =>
  queuedSubject(mutation).subjectIds[0];

const QUEUE_UNIT_FRAGMENT = gql`
  fragment QueueUnitData on Unit {
    id
    symbol
  }
`;

/** A queued `UnitRefInput`, read loosely: the queue persists untyped JSON. */
export interface UnitSpec {
  id?: string;
  name?: string;
  symbol?: string;
}

/** What a builder puts in a `UnitRefInput` slot: `@oneOf`, so one key. */
export type UnitRef = { id: string } | { symbol: string } | { name: string };

/** The cached symbol of a queued unit id; nothing when the spec has one. */
export const readUnitSymbol = (
  cache: ApolloCache,
  spec: UnitSpec,
): string | undefined => {
  if (spec.symbol || !spec.id) return undefined;
  const unit = cache.readFragment<{ id: string; symbol: string }>({
    id: cache.identify({ __typename: 'Unit', id: spec.id }),
    fragment: QUEUE_UNIT_FRAGMENT,
  });
  return firstNonBlank(unit?.symbol);
};

/**
 * A unit reference the server can still resolve after the vocabulary repair.
 * A queued id may name a merged-away row, and an id is not re-resolvable — a
 * symbol is. So a known symbol stands in for the id. Best-effort: with no
 * cached unit the id goes as queued.
 */
export const readUnitSpec = (
  cache: ApolloCache,
  spec: UnitSpec,
): UnitRef | undefined => {
  const symbol = firstNonBlank(spec.symbol) ?? readUnitSymbol(cache, spec);
  if (symbol) return { symbol };
  if (spec.id) return { id: spec.id };
  return spec.name ? { name: spec.name } : undefined;
};

/** The unit spec with a captured symbol beside its id, unless it has one. */
export const withUnitSymbol = (
  spec: UnitSpec,
  unitSymbol: string | undefined,
): UnitSpec =>
  spec.symbol || !unitSymbol || !spec.id
    ? spec
    : { ...spec, symbol: unitSymbol };
