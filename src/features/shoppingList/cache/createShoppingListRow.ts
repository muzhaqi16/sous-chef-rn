/**
 * The local-first lifecycle of one shopping-row create, for every surface that
 * adds a line: mint the id, hold the row as a pending write, send it and
 * settle. The surface keeps its own success UX.
 */

import type { ApolloCache } from '@apollo/client';
import type { DocumentNode } from 'graphql';
import type {
  AddItemsToShoppingListInput,
  BatchAddShoppingListItemInput,
} from '#/graphql/generated/schemaTypes';
import {
  pendingWritesOf,
  type LocalWriteSend,
} from '#/apollo/pendingWrites/pendingWrites';
import {
  settleMutation,
  type SettledFailure,
} from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { generateEntityId } from '#/utils/generateEntityId';
import { isRecord } from '#/utils/isRecord';
import { itemIdOf, type SentItemRef } from '#/utils/refInput';
import { t } from '#/i18n';
import type { AddRowsInputs } from '#features/shoppingList/offline/localWrites';
import {
  createLocalShoppingListItem,
  type OptimisticShoppingListItemFields,
} from './items';

/**
 * What a new row shows until the server answers; its list is the create's, and
 * its item the one the line names unless the row states its own (a line naming
 * a product record still names the item that record is of).
 */
export type ShoppingRowFields = Omit<
  OptimisticShoppingListItemFields,
  'shoppingListId'
>;

/** The line as sent, less the id the create mints. */
export type ShoppingRowLine = Omit<
  BatchAddShoppingListItemInput,
  'id' | 'item'
> & {
  item: SentItemRef;
};

interface ShoppingRowCreate<TData> {
  listId: string;
  row: ShoppingRowFields;
  line: ShoppingRowLine;
  /** Fires the surface's own copy of the batch add. */
  send: (
    options: LocalWriteSend<{ input: AddItemsToShoppingListInput }>,
  ) => Promise<{ data?: TData | null; error?: unknown }>;
  document: DocumentNode;
  /** The surface's copy for a refusal nothing more specific describes. */
  fallback: string;
}

interface ShoppingRowCreated<TData> {
  /**
   * The row the line landed on: the server's when it folded the add into a
   * line it held, else the id the create minted.
   */
  id: string;
  /** `kept` once the row is added or its create queued. */
  outcome: 'kept' | 'reverted';
  /** Why the row was withdrawn, for the surface to present; never presented here. */
  failure: SettledFailure | null;
  data: TData | null | undefined;
}

/** The batch's only line, as an applied response states it. */
function answeredLine(data: unknown): Record<string, unknown> | null {
  const payload: unknown = appliedPayload(data);
  const results: unknown = isRecord(payload) ? payload.results : undefined;
  const line: unknown = Array.isArray(results) ? results[0] : undefined;
  return isRecord(line) ? line : null;
}

/** The batch can apply while refusing its only line; that comes with no code worth naming. */
function refusedLine(data: unknown): boolean {
  const line = answeredLine(data);
  return !!line && (line.success === false || line.item === null);
}

/** The row the server put the line on, which differs from the minted id after a merge. */
function landedRowId(data: unknown): string | null {
  const item = answeredLine(data)?.item;
  return isRecord(item) && typeof item.id === 'string' ? item.id : null;
}

export async function createShoppingListRow<TData>(
  cache: ApolloCache,
  { listId, row, line, send, document, fallback }: ShoppingRowCreate<TData>,
): Promise<ShoppingRowCreated<TData>> {
  const id = generateEntityId();
  const inputs: AddRowsInputs = {
    listId,
    rows: [
      createLocalShoppingListItem(id, {
        ...row,
        itemId: row.itemId ?? itemIdOf(line.item),
        shoppingListId: listId,
      }),
    ],
    now: new Date().toISOString(),
  };

  const settled = await pendingWritesOf(cache).send(
    document,
    { input: { shoppingListId: listId, items: [{ ...line, id }] } },
    write =>
      settleMutation(() => send(write), {
        document,
        fallback,
        present: 'none',
      }),
    inputs,
  );
  if (settled.failure) {
    return { id, outcome: 'reverted', failure: settled.failure, data: null };
  }
  if (refusedLine(settled.data)) {
    return {
      id,
      outcome: 'reverted',
      failure: {
        code: null,
        field: null,
        title: t('labels.error'),
        body: fallback,
      },
      data: settled.data,
    };
  }
  return {
    id: landedRowId(settled.data) ?? id,
    outcome: 'kept',
    failure: null,
    data: settled.data,
  };
}
