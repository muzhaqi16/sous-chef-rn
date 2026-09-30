/**
 * The local-first lifecycle of one shopping-row create, for every surface that
 * adds a line: mint the id, write the row, send it local-first, settle, and
 * withdraw the row on a refusal. The surface keeps its own success UX.
 */

import type { ApolloCache } from '@apollo/client';
import type { DocumentNode } from 'graphql';
import type {
  AddItemsToShoppingListInput,
  BatchAddShoppingListItemInput,
} from '#/graphql/generated/schemaTypes';
import {
  settleMutation,
  type SettledFailure,
} from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { generateEntityId } from '#/utils/generateEntityId';
import { isRecord } from '#/utils/isRecord';
import { errorService } from '#/services/errorService';
import { t } from '#/i18n';
import {
  addLocalShoppingListItem,
  createLocalShoppingListItem,
  type OptimisticShoppingListItemFields,
} from './items';
import { withdrawShoppingListItems } from './withdraw';

/** What a new row shows until the server answers; its list is the create's. */
export type ShoppingRowFields = Omit<
  OptimisticShoppingListItemFields,
  'shoppingListId'
>;

interface ShoppingRowCreate<TData> {
  listId: string;
  row: ShoppingRowFields;
  /** The line as sent, less the id this mints. */
  line: Omit<BatchAddShoppingListItemInput, 'id'>;
  /** Fires the surface's own copy of the batch add. */
  send: (options: {
    variables: { input: AddItemsToShoppingListInput };
    context: { localFirst: boolean };
  }) => Promise<{ data?: TData | null; error?: unknown }>;
  document: DocumentNode;
  /** The surface's copy for a refusal nothing more specific describes. */
  fallback: string;
}

interface ShoppingRowCreated<TData> {
  /** `kept` once the row is added or its create queued. */
  outcome: 'kept' | 'reverted';
  /** Why the row was withdrawn, for the surface to present; never presented here. */
  failure: SettledFailure | null;
  data: TData | null | undefined;
}

/** The batch can apply while refusing its only line; that comes with no code worth naming. */
function refusedLine(data: unknown): boolean {
  const payload: unknown = appliedPayload(data);
  const results: unknown = isRecord(payload) ? payload.results : undefined;
  const line: unknown = Array.isArray(results) ? results[0] : undefined;
  return isRecord(line) && (line.success === false || line.item === null);
}

export async function createShoppingListRow<TData>(
  cache: ApolloCache,
  { listId, row, line, send, document, fallback }: ShoppingRowCreate<TData>,
): Promise<ShoppingRowCreated<TData>> {
  const id = generateEntityId();
  const withdraw = () => {
    try {
      withdrawShoppingListItems(cache, listId, [id]);
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Revert rejected Shopping List Item',
      });
    }
  };
  const local = createLocalShoppingListItem(id, {
    ...row,
    shoppingListId: listId,
  });
  try {
    addLocalShoppingListItem(cache, listId, local);
  } catch (cacheError) {
    errorService.reportError(cacheError, {
      operation: 'Add Shopping List Item (optimistic)',
    });
  }

  const settled = await settleMutation(
    () =>
      send({
        variables: {
          input: { shoppingListId: listId, items: [{ ...line, id }] },
        },
        context: { localFirst: true },
      }),
    { document, fallback, present: 'none', onFailed: withdraw },
  );
  if (settled.failure) {
    return { outcome: 'reverted', failure: settled.failure, data: null };
  }
  if (refusedLine(settled.data)) {
    withdraw();
    return {
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
  return { outcome: 'kept', failure: null, data: settled.data };
}
