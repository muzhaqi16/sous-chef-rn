import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import {
  ErrorCode,
  type AddItemsToShoppingListInput,
} from '#/graphql/generated/schemaTypes';
import { AddItemToShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { errorService } from '#/services/errorService';
import { operationNameOf } from '#/apollo/utils/documentOperation';
import { createShoppingListRow } from '../createShoppingListRow';
import { seedFragment } from '#/test-utils/apolloMockProvider';

jest.mock('#/services/errorService');

const LIST = gql`
  fragment CreateShoppingListRowProbe on ShoppingList {
    id
    totalItems
    completedItems
    remainingItems
    completionRate
  }
`;

function seededCache() {
  const cache = makeCache();
  seedFragment(cache, {
    fragment: LIST,
    data: {
      __typename: 'ShoppingList',
      id: 'list-1',
      totalItems: 2,
      completedItems: 1,
      remainingItems: 1,
      completionRate: 0.5,
    },
  });
  return cache;
}

const listCounts = (cache: ReturnType<typeof makeCache>) =>
  cache.readFragment<{ totalItems: number; remainingItems: number }>({
    id: 'ShoppingList:list-1',
    fragment: LIST,
  });

const rowIds = (cache: ReturnType<typeof makeCache>) =>
  Object.keys(cache.extract()).filter(key =>
    key.startsWith('ShoppingListItem:'),
  );

// A typed name, under the item id its door minted.
const TYPED_MILK = { inline: { id: 'item-minted', name: 'Milk' } };

function create(
  cache: ReturnType<typeof makeCache>,
  answer: { data?: unknown; error?: unknown } | Error,
) {
  const send = jest.fn(() =>
    answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer),
  );
  const created = createShoppingListRow(cache, {
    listId: 'list-1',
    row: { itemName: 'Milk' },
    line: { item: TYPED_MILK },
    send,
    document: AddItemToShoppingListDocument,
    fallback: 'Could not add it',
  });
  return { created, send };
}

describe('createShoppingListRow', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends the minted line local-first under the id it wrote', async () => {
    const cache = seededCache();
    const { created, send } = create(cache, {
      data: {},
    });

    await created;

    const [minted] = rowIds(cache);
    expect(send).toHaveBeenCalledWith({
      variables: {
        input: {
          shoppingListId: 'list-1',
          items: [{ item: TYPED_MILK, id: minted?.split(':')[1] }],
        },
      },
      context: { localFirst: true },
    });
  });

  it('names the typed item on the row before the API answers', async () => {
    const cache = seededCache();

    const { created } = create(cache, {
      data: {},
    });
    const [minted] = rowIds(cache);
    const named = cache.extract()[minted ?? '']?.item;
    await created;

    expect(named).toEqual({ __ref: 'Item:item-minted' });
  });

  it('keeps a queued create and counts it', async () => {
    const cache = seededCache();

    const outcome = await create(cache, {
      data: {},
    }).created;

    expect(outcome).toMatchObject({ outcome: 'kept', failure: null });
    expect(rowIds(cache)).toHaveLength(1);
    expect(listCounts(cache)).toMatchObject({
      totalItems: 3,
      remainingItems: 2,
    });
  });

  it('names the minted row while the create is queued', async () => {
    const cache = seededCache();

    const outcome = await create(cache, {
      data: {},
    }).created;

    const [minted] = rowIds(cache);
    expect(`ShoppingListItem:${outcome.id}`).toBe(minted);
  });

  it('names the line the server folded the add into', async () => {
    const cache = seededCache();

    const outcome = await create(cache, {
      data: {
        addItemsToShoppingList: {
          __typename: 'AddItemsToShoppingListPayload',
          results: [{ item: { id: 'line-held' } }],
        },
      },
    }).created;

    expect(outcome).toMatchObject({ outcome: 'kept', id: 'line-held' });
  });

  it('names the minted row when the server kept it', async () => {
    const cache = seededCache();
    // The server answers with the id it was sent.
    const send = jest.fn(
      ({ variables }: { variables: { input: AddItemsToShoppingListInput } }) =>
        Promise.resolve({
          data: {
            addItemsToShoppingList: {
              __typename: 'AddItemsToShoppingListPayload',
              results: [
                {
                  item: { id: variables.input.items[0]?.id },
                },
              ],
            },
          },
        }),
    );

    const outcome = await createShoppingListRow(cache, {
      listId: 'list-1',
      row: { itemName: 'Milk' },
      line: { item: TYPED_MILK },
      send,
      document: AddItemToShoppingListDocument,
      fallback: 'Could not add it',
    });

    const sentId = send.mock.calls[0]?.[0].variables.input.items[0]?.id;
    expect(sentId).toEqual(expect.any(String));
    expect(outcome).toMatchObject({ outcome: 'kept', id: sentId });
  });

  it('withdraws a refused create, uncounts it, and returns the failure', async () => {
    const cache = seededCache();

    const outcome = await create(cache, {
      data: {
        addItemsToShoppingList: {
          __typename: 'ForbiddenError',
          code: ErrorCode.Forbidden,
        },
      },
    }).created;

    expect(outcome.outcome).toBe('reverted');
    expect(outcome.failure?.code).toBe(ErrorCode.Forbidden);
    expect(rowIds(cache)).toEqual([]);
    expect(listCounts(cache)).toMatchObject({
      totalItems: 2,
      remainingItems: 1,
    });
  });

  it('withdraws the line a batch applied while refusing it', async () => {
    const cache = seededCache();

    const outcome = await create(cache, {
      data: {
        addItemsToShoppingList: {
          __typename: 'AddItemsToShoppingListPayload',
          results: [{ item: null }],
        },
      },
    }).created;

    expect(outcome).toMatchObject({
      outcome: 'reverted',
      failure: { body: 'Could not add it' },
    });
    expect(rowIds(cache)).toEqual([]);
    expect(listCounts(cache)?.totalItems).toBe(2);
  });

  it('reports a create that throws, and withdraws it', async () => {
    const cache = seededCache();

    const outcome = await create(cache, new Error('boom')).created;

    expect(outcome.outcome).toBe('reverted');
    expect(rowIds(cache)).toEqual([]);
    expect(errorService.reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        operation: operationNameOf(AddItemToShoppingListDocument),
      }),
    );
  });
});
