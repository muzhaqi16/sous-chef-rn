import { act } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { useAddShoppingItem } from '../useAddShoppingItem';
import {
  addOptimisticShoppingListItem,
  createOptimisticShoppingListItem,
  reconcileShoppingCreate,
} from '#features/shoppingList/cache/items';
import { AddItemToShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { alertService } from '#/services/alertService';

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

// The response mirrors the real batch payload the hook reads
// (`addItemsToShoppingList.results[0].item`) so the real reconciler classifies
// it as a success and keeps the optimistic row. `variables: () => true` because
// the hook mints the row's cuid id itself.
const addItemMock = () =>
  recordMock(AddItemToShoppingListDocument, {
    data: {
      addItemsToShoppingList: {
        __typename: 'AddItemsToShoppingListPayload',
        results: [
          {
            __typename: 'BatchAddShoppingListItemResult',
            success: true,
            item: { __typename: 'ShoppingListItem', id: 'srv-1' },
          },
        ],
      },
    },
  });

jest.mock('#features/shoppingList/cache/connections', () => ({
  ...jest.requireActual('#features/shoppingList/cache/connections'),
  // A leaf cache writer, stubbed so the hook runs without a live cache.
  addNewItemToShoppingListCache: jest.fn(),
}));

jest.mock('#features/shoppingList/cache/items', () => {
  const actual = jest.requireActual('#features/shoppingList/cache/items');
  return {
    // Keep the REAL reconcileShoppingCreate (and the settledStatus it
    // calls) so the keep/revert decision under test is production's — a
    // hand-copied reconciler drifts from the operation names it hard-codes.
    ...actual,
    // Wrapped, not replaced: its revert is module-internal, so what it RETURNS
    // is the observable keep/revert decision.
    reconcileShoppingCreate: jest.fn(actual.reconcileShoppingCreate),
    // Leaf cache writers are stubbed so the hook runs without a live cache.
    revertOptimisticShoppingListItem: jest.fn(),
    addOptimisticShoppingListItem: jest.fn(),
    // Signature: (id, fields) => entity (the cuid is baked straight in).
    createOptimisticShoppingListItem: jest.fn(
      (id: string, fields: { itemName?: string }) => ({
        __typename: 'ShoppingListItem',
        id,
        itemName: fields?.itemName ?? '',
      }),
    ),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useAddShoppingItem', () => {
  const mockRefetch = jest.fn().mockResolvedValue(undefined);

  it('returns addItem function', () => {
    const { result } = renderHookWithApollo(() =>
      useAddShoppingItem({ listId: 'list-1', refetch: mockRefetch }),
    );

    expect(typeof result.current.addItem).toBe('function');
  });

  it('writes the new item PERMANENTLY with a client-minted cuid id BEFORE firing the mutation (Pattern B / local-first)', async () => {
    const created = addItemMock();
    const { result } = renderHookWithApollo(
      () => useAddShoppingItem({ listId: 'list-1', refetch: mockRefetch }),
      { operationMocks: [created.mock] },
    );

    await act(async () => {
      await result.current.addItem({ itemName: 'Milk', quantity: 2 });
    });

    // The optimistic item was written with a real cuid2 id (the row's PK).
    expect(addOptimisticShoppingListItem).toHaveBeenCalledTimes(1);
    const writtenItem = (addOptimisticShoppingListItem as jest.Mock).mock
      .calls[0][2];
    // Matches the server id validator (cuid2 or legacy cuid v1 / 24-char hex).
    expect(writtenItem.id).toMatch(
      /^(?:[a-z][0-9a-z]{23,31}|[0-9a-fA-F]{24})$/,
    );

    // The create mutation was then fired.
    expect(created.fired).toHaveLength(1);
  });

  it('gives the optimistic row the fraction the form typed, not its leading number', async () => {
    const created = addItemMock();
    const { result } = renderHookWithApollo(
      () => useAddShoppingItem({ listId: 'list-1', refetch: mockRefetch }),
      { operationMocks: [created.mock] },
    );

    await act(async () => {
      await result.current.addItem({
        itemName: 'Flour',
        quantityInput: '1 1/2',
      });
    });

    expect(createOptimisticShoppingListItem).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ quantity: 1.5, quantityInput: '1 1/2' }),
    );
  });

  it('reports a queued add as added, so quick-add does not call it a failure', async () => {
    const queued = recordMock(AddItemToShoppingListDocument, {
      data: { addItemsToShoppingList: null },
    });
    const { result } = renderHookWithApollo(
      () => useAddShoppingItem({ listId: 'list-1', refetch: mockRefetch }),
      { operationMocks: [queued.mock] },
    );

    let added: boolean | undefined;
    await act(async () => {
      added = await result.current.addItem({ itemName: 'Milk' });
    });

    expect(added).toBe(true);
    expect(jest.mocked(reconcileShoppingCreate).mock.results).toEqual([
      { type: 'return', value: 'kept' },
    ]);
    expect(alertService.alert).not.toHaveBeenCalled();
  });

  it('reverts and reports a refused add', async () => {
    const refused = recordMock(AddItemToShoppingListDocument, {
      data: {
        addItemsToShoppingList: {
          __typename: 'ForbiddenError',
          code: ErrorCode.Forbidden,
        },
      },
    });
    const { result } = renderHookWithApollo(
      () => useAddShoppingItem({ listId: 'list-1', refetch: mockRefetch }),
      { operationMocks: [refused.mock] },
    );

    let added: boolean | undefined;
    await act(async () => {
      added = await result.current.addItem({ itemName: 'Milk' });
    });

    expect(added).toBe(false);
    expect(jest.mocked(reconcileShoppingCreate).mock.results).toEqual([
      { type: 'return', value: 'reverted' },
    ]);
    expect(alertService.alert).toHaveBeenCalledTimes(1);
  });

  it('does nothing when listId is missing', async () => {
    const created = addItemMock();
    const { result } = renderHookWithApollo(
      () => useAddShoppingItem({ listId: null, refetch: mockRefetch }),
      { operationMocks: [created.mock] },
    );

    await act(async () => {
      await result.current.addItem({ itemName: 'Milk' });
    });

    expect(addOptimisticShoppingListItem).not.toHaveBeenCalled();
    expect(created.fired).toHaveLength(0);
  });
});
