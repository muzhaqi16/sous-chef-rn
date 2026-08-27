import type { DocumentNode } from 'graphql';
import type { ApolloCache } from '@apollo/client';
import type { QueuedMutation } from './types';

/**
 * The contract between the offline queue and the features whose writes it
 * replays.
 *
 * The queue knows how to replay; only the feature knows what its mutation's
 * input means. So the kernel owns this file — the shape of a replay, the loose
 * shape of a queued input, and the two id helpers every builder needs — and
 * each participating feature owns the builders themselves under its own
 * `offline/` directory, exported as an op-name → builder table.
 *
 * A builder receives the cache rather than pre-bound readers: the fields a
 * replay must backfill are the feature's own (`PantryItem.pantryId`, a shopping
 * row's catalog ref), so the fragment that reads them belongs beside the
 * builder that needs it, not in the queue manager.
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
 * Loose shape of a queued mutation's `input`. It is persisted untyped (the queue
 * stores arbitrary mutation variables), so this documents the fields the builders
 * read across the mapped operations. Quantity/update shopping ops send the unit as
 * flat `unitId` / `unitName` scalars rather than a `unit` object; the shopping
 * builder normalizes both.
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
  // The single-add ops send the batch AddItemsToShoppingListInput shape
  // ({ shoppingListId, items: [<one item>] }); the shopping builder flattens
  // items[0] so its per-field reads work for both batch-add and flat inputs.
  items?: QueuedInput[];
  [key: string]: unknown;
}

export const getQueuedInput = (mutation: QueuedMutation): QueuedInput =>
  (mutation.variables.input ?? {}) as QueuedInput;

/**
 * The client-minted permanent cuid IS the sync `clientId`. It rides on the
 * mutation input as `id` (create/update/toggle/delete) or `itemId` (qty/move).
 *
 * Returns `undefined` for a malformed queued input with no id. That is
 * deliberate: the client mints permanent cuids, so a missing id surfaces as
 * `undefined` (the server rejects it as a permanent failure) rather than being
 * back-filled with a fabricated `temp-` id. Builders therefore cast it to the
 * generated `Sync*Input`'s required `clientId: ID` — the cast preserves the
 * undefined-flows-through behavior (a compile-time cast doesn't coerce at
 * runtime) while satisfying the schema type.
 */
export const getClientId = (
  mutation: QueuedMutation,
  input: QueuedInput,
): string | undefined =>
  input.id ?? input.itemId ?? (mutation.variables.id as string | undefined);
