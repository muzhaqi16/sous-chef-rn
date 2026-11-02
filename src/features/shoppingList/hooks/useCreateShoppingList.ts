/**
 * Local-first: the list is held under the minted `input.id` until the server
 * answers; the caller's own replay converges on it, and an id another account
 * holds answers CONFLICT, which drops it and reports it.
 * The first 50 lines it is made with ride the create and show with it.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import { CreateShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { ADD_ITEMS_BATCH_LIMIT } from '#features/shoppingList/cache/createShoppingListRow';
import type { LocalShoppingListItem } from '#features/shoppingList/cache/items';
import type { CreateListInputs } from '#features/shoppingList/offline/localWrites';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { generateEntityId } from '#/utils/generateEntityId';
import { useUser } from '#store/useAppStore';
import type {
  BatchAddShoppingListItemInput,
  CreateShoppingListInput,
} from '#/graphql/generated/schemaTypes';

/** Lines a new list is made with, each under the id minted for it. */
export interface StartingLines<TItem extends BatchAddShoppingListItemInput> {
  items: readonly TItem[];
  /** What a line shows under the new list's id until the server answers. */
  rowOf: (line: TItem, listId: string) => LocalShoppingListItem | null;
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

    const inputs: CreateListInputs = {
      list: {
        id,
        name: input.name,
        isDefault: input.isDefault,
        homeId: input.homeId,
      },
      // Materializing the ownership row needs an auth identity; without one the
      // create is online-only (no create surface should hit this).
      owner: user && {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
      rows: sent.flatMap(line => lines?.rowOf(line, id) ?? []),
      now: new Date().toISOString(),
    };
    const settled = await pendingWritesOf(client.cache).send(
      CreateShoppingListDocument,
      { input: { ...input, id, ...(sent.length > 0 && { items: sent }) } },
      write =>
        settleMutation(() => mutate(write), {
          document: CreateShoppingListDocument,
          fallback: fallbackErrorMessage,
          present: 'none',
        }),
      inputs,
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
