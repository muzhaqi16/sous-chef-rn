/**
 * Local-first: the list is cached PERMANENTLY before firing under the minted
 * `input.id`; the caller's own replay answers IDEMPOTENT_REPLAY (applied), and an
 * id another account holds answers CONFLICT, which withdraws and reports it.
 * Lines it is made with are cached with it and the first 50 ride the create.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { CreateShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import {
  addShoppingListToQueryCache,
  revertOptimisticShoppingList,
  writeLocalShoppingList,
} from '#features/shoppingList/cache/list';
import {
  ADD_ITEMS_BATCH_LIMIT,
  buildAddItemsReconcileUpdate,
} from '#features/shoppingList/cache/items';
import { withdrawShoppingListItems } from '#features/shoppingList/cache/withdraw';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { generateEntityId } from '#/utils/generateEntityId';
import { useUser } from '#store/useAppStore';
import type {
  BatchAddShoppingListItemInput,
  CreateShoppingListInput,
} from '#/graphql/generated/schemaTypes';
import { errorService } from '#/services/errorService';

/** Lines a new list is made with, each under the id minted for it. */
export interface StartingLines<TItem extends BatchAddShoppingListItemInput> {
  items: readonly TItem[];
  /** Caches the lines under the new list's id, before the create fires. */
  write: (listId: string) => void;
}

/**
 * The created list — the server's when it answered, the local one when queued —
 * and the starting lines past what one create carries, for batch adds to send.
 */
export type CreateShoppingListOutcome<TItem = never> =
  | {
      status: 'created';
      shoppingList: { id: string; name: string };
      unsent: TItem[];
    }
  | { status: 'failed'; body: string };

export function useCreateShoppingList(fallbackErrorMessage: string) {
  const client = useApolloClient();
  const user = useUser();

  const [mutate, { loading }] = useMutation(CreateShoppingListDocument, {
    context: { localFirst: true },
    update(cache, result, options) {
      const created = appliedPayload(result.data);
      if (!created) return;
      addShoppingListToQueryCache(cache, created.shoppingList);
      buildAddItemsReconcileUpdate({ listId: created.shoppingList.id })(
        cache,
        result,
        options,
      );
    },
  });

  const createShoppingList = async <
    TItem extends BatchAddShoppingListItemInput = never,
  >(
    input: CreateShoppingListInput,
    lines?: StartingLines<TItem>,
  ): Promise<CreateShoppingListOutcome<TItem>> => {
    const id = generateEntityId();
    const items = lines?.items ?? [];
    const sent = items.slice(0, ADD_ITEMS_BATCH_LIMIT);
    const unsent = items.slice(ADD_ITEMS_BATCH_LIMIT);
    const lineIds = items.flatMap(line => (line.id ? [line.id] : []));
    const writeLines = lines?.write ?? (() => {});

    // Materializing the ownership row needs an auth identity; without one the
    // create falls back to online-only (no create surface should hit this).
    if (user) {
      try {
        writeLocalShoppingList(client.cache, id, input, user);
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Create Shopping List (optimistic)',
        });
      }
      // The lines still ride the create, and its answer writes the server's.
      try {
        writeLines(id);
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Create Shopping List lines (optimistic)',
        });
      }
    }

    const settled = await settleMutation(
      () =>
        mutate({
          variables: {
            input: { ...input, id, ...(sent.length > 0 && { items: sent }) },
          },
        }),
      {
        document: CreateShoppingListDocument,
        fallback: fallbackErrorMessage,
        present: 'none',
        onFailed: () => {
          if (!user) return;
          // Every starting line was cached, the unsent ones included.
          try {
            withdrawShoppingListItems(client.cache, id, lineIds);
            revertOptimisticShoppingList(client.cache, id);
          } catch (cacheError) {
            errorService.reportError(cacheError, {
              operation: 'Revert failed Shopping List create',
            });
          }
        },
      },
    );

    if (settled.status === 'failed') {
      return {
        status: 'failed',
        body: settled.failure?.body ?? fallbackErrorMessage,
      };
    }

    const created = appliedPayload(settled.data)?.shoppingList;
    if (created) return { status: 'created', shoppingList: created, unsent };
    // Queued: the local list stands and the create replays under the same id.
    if (user) {
      return {
        status: 'created',
        shoppingList: { id, name: input.name },
        unsent,
      };
    }
    return { status: 'failed', body: fallbackErrorMessage };
  };

  return { createShoppingList, loading };
}
