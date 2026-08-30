import type { DocumentNode } from 'graphql';
import type { ApolloCache } from '@apollo/client';
import type { QueuedMutation } from './types';

/**
 * The contract between the queue and the features whose writes it replays: the
 * kernel owns these shapes, each feature owns its builders under its own
 * `offline/`. A builder takes the cache, not pre-bound readers, so a feature's
 * backfill fragment lives beside it rather than in the queue manager.
 */
export interface SyncConversion {
  syncMutation: DocumentNode;
  syncVariables: Record<string, unknown>;
}

export type SyncBuilder = (
  mutation: QueuedMutation,
  cache: ApolloCache,
) => SyncConversion;

/** op-name → builder, the shape a feature's `offline/syncBuilders.ts` exports. */
export type SyncBuilderTable = Record<string, SyncBuilder>;

/**
 * Loose shape of a queued `input`, persisted untyped. Quantity/update shopping
 * ops send the unit as flat `unitId`/`unitName` scalars rather than a `unit`
 * object; the shopping builder normalizes both.
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
  unit?: { unitId?: string; unitName?: string };
  unitId?: string;
  unitName?: string;
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
 * The client-minted permanent cuid IS the sync `clientId`. A malformed input
 * with no id yields `undefined` on purpose, so the server refuses it rather
 * than it being back-filled with a fabricated id; builders cast to
 * `Sync*Input`'s required `clientId: ID`, and a cast does not coerce.
 */
export const getClientId = (
  mutation: QueuedMutation,
  input: QueuedInput,
): string | undefined =>
  input.id ?? input.itemId ?? (mutation.variables.id as string | undefined);
