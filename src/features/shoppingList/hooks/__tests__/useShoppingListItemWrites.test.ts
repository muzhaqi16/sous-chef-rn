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
  UpdateShoppingListItemDocument,
  type AddItemToShoppingListMutationVariables,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { ShoppingListItemForEditDocument } from '../useShoppingListItemWrites.generated';
import { toastService } from '#/services/toastService';
import { getDeviceDecimalSeparator } from '#/utils/deviceLocale';
import { useShoppingListItemWrites } from '../useShoppingListItemWrites';

jest.mock('#/utils/deviceLocale', () => ({
  ...jest.requireActual('#/utils/deviceLocale'),
  getDeviceDecimalSeparator: jest.fn(() => '.'),
}));

jest.mock('#/services/errorService');

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
  const itemQuery = recordMock(ShoppingListItemForEditDocument, {
    data: {
      shoppingListItem: { id: 'item-1' },
    },
  });
  const update = recordMock(UpdateShoppingListItemDocument, {
    data: {
      updateShoppingListItem:
        outcome === 'applied'
          ? {
              __typename: 'UpdateShoppingListItemPayload',
              shoppingListItem: {
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
      optimistic: true,
    });
  return { ...rendered, itemQuery, readItem };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getDeviceDecimalSeparator).mockReturnValue('.');
});

describe('useShoppingListItemWrites.updateItem', () => {
  it('shows the edit before the server answers, for a restart', async () => {
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

  it('shows the item as it was when the server refuses the edit', async () => {
    const { result, readItem } = setup('refused');
    await waitFor(() => expect(result.current.itemData).not.toBeNull());
    const before = readItem() ?? {};

    let updated: boolean | undefined;
    await act(async () => {
      updated = await result.current.updateItem(
        { id: 'item-1', version: 3, ...EDIT },
        jest.fn(),
      );
    });

    expect(updated).toBe(false);
    expect(readItem()).toMatchObject(before);
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
                index: 0,
                success: true,
                packageSizeCleared,
                item: {
                  id: row?.id ?? '',
                  shoppingList: { id: 'list-1' },
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
        { itemName: 'Pasta sauce', quantity: 1 },
        {
          item: { inline: { id: 'item-sauce', name: 'Pasta sauce' } },
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
        { itemName: 'Pasta sauce', quantity: 1 },
        {
          item: { inline: { id: 'item-sauce', name: 'Pasta sauce' } },
          quantity: '1',
        },
      );
    });

    expect(toastService.info).not.toHaveBeenCalled();
  });
});

describe('useShoppingListItemWrites.createItem, for a typed name', () => {
  const typed = { inline: { id: 'item-minted', name: 'Cubanelle pepper' } };

  /** An add answered with its line naming `servedItemId`. */
  function answeredWith(servedItemId: string) {
    const cache = seedCache([]);
    const add = recordMock(AddItemToShoppingListDocument, {
      dataFor: (vars): MockDataFor<typeof AddItemToShoppingListDocument> => {
        const [row] = (vars as AddItemToShoppingListMutationVariables).input
          .items;
        return {
          addItemsToShoppingList: {
            __typename: 'AddItemsToShoppingListPayload',
            results: [
              {
                index: 0,
                success: true,
                item: {
                  id: row?.id ?? '',
                  shoppingList: { id: 'list-1' },
                  item: { id: servedItemId },
                },
              },
            ],
          },
        };
      },
    });
    const rendered = renderHookWithApollo(
      () => useShoppingListItemWrites('list-1', undefined),
      { cache, operationMocks: [add.mock] },
    );
    return { cache, add, ...rendered };
  }

  const lineOf = (cache: ReturnType<typeof seedCache>, optimistic = false) => {
    const stored = cache.extract(optimistic);
    const [key] = Object.keys(stored).filter(id =>
      id.startsWith('ShoppingListItem:'),
    );
    return key ? stored[key] : undefined;
  };

  it('re-points a typed item the API matched to one it holds', async () => {
    const { cache, add, result } = answeredWith('item-held');

    let namedBefore: unknown;
    await act(async () => {
      const adding = result.current.createItem(
        { itemName: 'Cubanelle pepper', quantity: 1 },
        { item: typed, quantity: '1' },
      );
      namedBefore = lineOf(cache, true)?.item;
      await adding;
    });

    expect(add.fired).toEqual([
      expect.objectContaining({
        input: expect.objectContaining({
          items: [expect.objectContaining({ item: typed })],
        }),
      }),
    ]);
    expect(namedBefore).toEqual({ __ref: 'Item:item-minted' });
    expect(lineOf(cache)?.item).toEqual({ __ref: 'Item:item-held' });
    expect(cache.extract()['Item:item-minted']).toBeUndefined();
  });

  it('keeps the item the API created under the minted id', async () => {
    const { cache, result } = answeredWith('item-minted');

    await act(async () => {
      await result.current.createItem(
        { itemName: 'Cubanelle pepper', quantity: 1 },
        { item: typed, quantity: '1' },
      );
    });

    expect(lineOf(cache)?.item).toEqual({ __ref: 'Item:item-minted' });
    expect(cache.extract()['Item:item-minted']).toBeDefined();
  });
});
