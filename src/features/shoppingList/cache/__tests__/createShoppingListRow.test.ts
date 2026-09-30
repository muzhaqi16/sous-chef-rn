import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { AddItemToShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { errorService } from '#/services/errorService';
import { operationNameOf } from '#/apollo/utils/documentOperation';
import { createShoppingListRow } from '../createShoppingListRow';

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
  cache.writeFragment({
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
    line: { item: { itemName: 'Milk' } },
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
      data: { addItemsToShoppingList: null },
    });

    await created;

    const [minted] = rowIds(cache);
    expect(send).toHaveBeenCalledWith({
      variables: {
        input: {
          shoppingListId: 'list-1',
          items: [{ item: { itemName: 'Milk' }, id: minted?.split(':')[1] }],
        },
      },
      context: { localFirst: true },
    });
  });

  it('keeps a queued create and counts it', async () => {
    const cache = seededCache();

    const outcome = await create(cache, {
      data: { addItemsToShoppingList: null },
    }).created;

    expect(outcome).toMatchObject({ outcome: 'kept', failure: null });
    expect(rowIds(cache)).toHaveLength(1);
    expect(listCounts(cache)).toMatchObject({
      totalItems: 3,
      remainingItems: 2,
    });
  });

  it('withdraws a refused create, uncounts it, and returns the failure', async () => {
    const cache = seededCache();

    const outcome = await create(cache, {
      data: {
        addItemsToShoppingList: {
          __typename: 'ForbiddenError',
          code: ErrorCode.Forbidden,
          message: 'no',
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
          results: [{ index: 0, success: false, item: null }],
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
