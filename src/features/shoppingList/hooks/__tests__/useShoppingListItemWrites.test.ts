import { act, waitFor } from '@testing-library/react-native';
import { gql } from '@apollo/client';
import {
  recordMock,
  renderHookWithApollo,
  seedCache,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import {
  AddItemToShoppingListDocument,
  GetShoppingListItemDocument,
  UpdateShoppingListItemDocument,
  type AddItemToShoppingListMutationVariables,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { toastService } from '#/services/toastService';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { getDeviceDecimalSeparator } from '#/utils/deviceLocale';
import { useShoppingListItemWrites } from '../useShoppingListItemWrites';

jest.mock('#/utils/deviceLocale', () => ({
  ...jest.requireActual('#/utils/deviceLocale'),
  getDeviceDecimalSeparator: jest.fn(() => '.'),
}));

jest.mock('#/services/errorService');
jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));
jest.mock('#/services/toastService', () => ({
  toastService: { info: jest.fn() },
}));
jest.mock('#/apollo/offline/OptimisticDataPersistence', () => ({
  optimisticDataPersistence: {
    save: jest.fn(),
    clear: jest.fn(),
    track: jest.fn(() => jest.fn()),
  },
}));

const ITEM = gql`
  fragment ItemWritesProbe on ShoppingListItem {
    id
    itemName
    quantity
    quantityInput
    notes
  }
`;

type Item = {
  itemName: string | null;
  quantity: number | null;
  quantityInput: string | null;
  notes: string | null;
};

const EDIT = { itemName: 'Oat milk', notes: 'organic' };

function setup(outcome: 'applied' | 'refused') {
  const cache = seedCache([
    {
      __typename: 'ShoppingListItem',
      id: 'item-1',
      itemName: 'Milk',
      quantity: 1,
      quantityInput: '1',
      notes: null,
      version: 3,
    },
  ]);
  const itemQuery = recordMock(GetShoppingListItemDocument, {
    data: {
      shoppingListItem: { __typename: 'ShoppingListItem', id: 'item-1' },
    },
  });
  const update = recordMock(UpdateShoppingListItemDocument, {
    data: {
      updateShoppingListItem:
        outcome === 'applied'
          ? {
              __typename: 'UpdateShoppingListItemPayload',
              shoppingListItem: {
                __typename: 'ShoppingListItem',
                id: 'item-1',
              },
            }
          : {
              __typename: 'ValidationError',
              code: ErrorCode.ValidationFailed,
              message: 'refused',
              field: null,
            },
    },
  });
  const rendered = renderHookWithApollo(
    () => useShoppingListItemWrites('list-1', 'item-1'),
    { cache, operationMocks: [itemQuery.mock, update.mock] },
  );
  const readItem = () =>
    cache.readFragment<Item>({
      id: cache.identify({ __typename: 'ShoppingListItem', id: 'item-1' }),
      fragment: ITEM,
    });
  return { ...rendered, itemQuery, readItem };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getDeviceDecimalSeparator).mockReturnValue('.');
});

describe('useShoppingListItemWrites.updateItem', () => {
  it('writes the edit into the cache before the server answers, and records it for a restart', async () => {
    const { result, readItem } = setup('applied');
    // Loaded, not only sent: a refetch of a query still in flight is deduplicated.
    await waitFor(() => expect(result.current.itemData).not.toBeNull());

    let written: Item | null = null;
    await act(async () => {
      const pending = result.current.updateItem(
        { id: 'item-1', version: 3, quantity: '1 1/2', ...EDIT },
        jest.fn(),
      );
      // Offline nothing else lands: the queue resolves the write with no payload.
      written = readItem();
      await pending;
    });

    expect(written).toMatchObject({
      ...EDIT,
      quantity: 1.5,
      quantityInput: '1 1/2',
    });
    for (const [field, value] of Object.entries(EDIT)) {
      expect(optimisticDataPersistence.save).toHaveBeenCalledWith(
        expect.anything(),
        'item-1',
        field,
        value,
      );
    }
  });

  it('reads the API text it sends as API text on a comma device', async () => {
    jest.mocked(getDeviceDecimalSeparator).mockReturnValue(',');
    const { result, readItem } = setup('applied');
    await waitFor(() => expect(result.current.itemData).not.toBeNull());

    let written: Item | null = null;
    await act(async () => {
      const pending = result.current.updateItem(
        { id: 'item-1', version: 3, quantity: '1.250' },
        jest.fn(),
      );
      written = readItem();
      await pending;
    });

    expect(written).toMatchObject({ quantity: 1.25, quantityInput: '1.250' });
  });

  it('drops the recorded edit and re-reads the item when the server refuses it', async () => {
    const { result, itemQuery } = setup('refused');
    // Loaded, not only sent: a refetch of a query still in flight is deduplicated.
    await waitFor(() => expect(result.current.itemData).not.toBeNull());
    const readsBefore = itemQuery.fired.length;

    let updated: boolean | undefined;
    await act(async () => {
      updated = await result.current.updateItem(
        { id: 'item-1', version: 3, ...EDIT },
        jest.fn(),
      );
    });

    expect(updated).toBe(false);
    for (const field of Object.keys(EDIT)) {
      expect(optimisticDataPersistence.clear).toHaveBeenCalledWith(
        expect.anything(),
        'item-1',
        field,
      );
    }
    await waitFor(
      () => expect(itemQuery.fired.length).toBeGreaterThan(readsBefore),
      { timeout: 3000 },
    );
  });
});

describe('useShoppingListItemWrites.createItem', () => {
  function addWith(packageSizeCleared: boolean) {
    const add = recordMock(AddItemToShoppingListDocument, {
      dataFor: (vars): MockDataFor<typeof AddItemToShoppingListDocument> => {
        const [row] = (vars as AddItemToShoppingListMutationVariables).input
          .items;
        return {
          addItemsToShoppingList: {
            __typename: 'AddItemsToShoppingListPayload',
            results: [
              {
                __typename: 'BatchAddShoppingListItemResult',
                index: 0,
                success: true,
                packageSizeCleared,
                item: {
                  __typename: 'ShoppingListItem',
                  id: row?.id ?? '',
                  shoppingList: { __typename: 'ShoppingList', id: 'list-1' },
                },
              },
            ],
          },
        };
      },
    });
    return renderHookWithApollo(
      () => useShoppingListItemWrites('list-1', undefined),
      {
        operationMocks: [add.mock],
      },
    );
  }

  it('says so when an add leaves the line it joined with no package size', async () => {
    const { result } = addWith(true);

    await act(async () => {
      await result.current.createItem(
        { shoppingListId: 'list-1', itemName: 'Pasta sauce', quantity: 1 },
        {
          item: { itemName: 'Pasta sauce' },
          quantity: '1',
          netWeight: { netWeight: 22, netWeightUnitId: 'u-oz' },
        },
      );
    });

    expect(toastService.info).toHaveBeenCalledWith(
      'This item was already on the list with a different package size, so the line no longer records one.',
    );
  });

  it('says nothing when the line keeps its size', async () => {
    const { result } = addWith(false);

    await act(async () => {
      await result.current.createItem(
        { shoppingListId: 'list-1', itemName: 'Pasta sauce', quantity: 1 },
        { item: { itemName: 'Pasta sauce' }, quantity: '1' },
      );
    });

    expect(toastService.info).not.toHaveBeenCalled();
  });
});
