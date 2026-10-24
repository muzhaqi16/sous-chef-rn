import type { Unmasked } from '@apollo/client/masking';
import {
  completeMockedResponse,
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import {
  GetShoppingListItemsFilteredDocument,
  type GetShoppingListItemsFilteredQuery,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { PAGINATION } from '#features/shoppingList/utils/shoppingListConstants';
import { useStoreModeCart } from '../useStoreModeCart';

const mockToggleItem = jest.fn();
const mockRecordPurchase = jest.fn();
jest.mock('../mutations/useToggleShoppingItem', () => ({
  useToggleShoppingItem: () => ({
    toggleItem: (...args: unknown[]) => mockToggleItem(...args),
    recordPurchase: (...args: unknown[]) => mockRecordPurchase(...args),
  }),
}));

const LIST = 'list-1';
const JIF = { id: 'jif-creamy', conceptIds: ['peanut-butter'] };

interface LineSeed {
  id: string;
  itemId: string;
  itemName: string;
  estimated?: number | null;
  suggested?: number | null;
  unitId?: string;
}

const node = ({
  id,
  itemId,
  itemName,
  estimated = null,
  suggested = null,
  unitId,
}: LineSeed) => ({
  __typename: 'ShoppingListItem',
  id,
  itemName,
  quantity: 2,
  unitName: 'jar',
  unit: unitId
    ? { __typename: 'Unit', id: unitId, name: 'jar', symbol: 'jar' }
    : null,
  priceEstimate: { __typename: 'ShoppingListItemPriceEstimate', estimated },
  suggestedPrice:
    suggested === null
      ? null
      : { __typename: 'PriceSuggestion', amount: suggested },
  item: { __typename: 'Item', id: itemId },
});

/** Writes one tab of the list the way store mode's own read left it. */
function seedTab(
  cache: ReturnType<typeof seedCache>,
  isPurchased: boolean,
  lines: LineSeed[],
) {
  const variables = {
    id: LIST,
    first: PAGINATION.ITEMS_PAGE_SIZE,
    isPurchased,
  };
  const completed = completeMockedResponse({
    request: { query: GetShoppingListItemsFilteredDocument, variables },
    result: {
      data: {
        shoppingList: {
          __typename: 'ShoppingList',
          id: LIST,
          itemsConnection: {
            __typename: 'ShoppingListItemConnection',
            edges: lines.map((line, index) => ({
              __typename: 'ShoppingListItemEdge',
              cursor: `c-${index}`,
              node: node(line),
            })),
          },
        },
      },
    },
  }).result as (vars: typeof variables) => {
    data: Unmasked<GetShoppingListItemsFilteredQuery>;
  };
  cache.writeQuery({
    query: GetShoppingListItemsFilteredDocument,
    variables,
    data: completed(variables).data,
  });
}

function renderCart(
  toBuy: LineSeed[],
  inCart: LineSeed[] = [],
  scanned: Parameters<typeof useStoreModeCart>[1] = JIF,
) {
  const cache = seedCache([]);
  seedTab(cache, false, toBuy);
  seedTab(cache, true, inCart);
  // No operation mocks: the hook must answer from the cache alone.
  return renderHookWithApollo(() => useStoreModeCart(LIST, scanned), {
    cache,
    operationMocks: [],
  });
}

describe('useStoreModeCart', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('finds the line to buy that names a concept above the product', () => {
    const { result } = renderCart([
      { id: 'milk', itemId: 'milk', itemName: 'Milk' },
      {
        id: 'pb',
        itemId: 'peanut-butter',
        itemName: 'Peanut butter',
        suggested: 3.49,
        unitId: 'unit-jar',
      },
    ]);

    expect(result.current.unit).toEqual({ id: 'unit-jar', symbol: 'jar' });
    expect(result.current.line).toEqual({
      id: 'pb',
      itemName: 'Peanut butter',
      requestedQuantity: 2,
      unitName: 'jar',
      estimatedPrice: 3.49,
    });
    expect(result.current.inCart).toBe(false);
  });

  it('hints a typed estimate over the suggestion', () => {
    const { result } = renderCart([
      {
        id: 'pb',
        itemId: 'jif-creamy',
        itemName: 'Jif',
        estimated: 4,
        suggested: 3.49,
      },
    ]);

    expect(result.current.line?.estimatedPrice).toBe(4);
  });

  it('reports a product already in the cart, with no line to tick', () => {
    const { result } = renderCart(
      [],
      [{ id: 'pb', itemId: 'peanut-butter', itemName: 'Peanut butter' }],
    );

    expect(result.current.line).toBeNull();
    expect(result.current.inCart).toBe(true);
  });

  it('ticks with no price through the plain toggle', async () => {
    mockToggleItem.mockResolvedValue(true);
    const { result } = renderCart([]);

    await expect(result.current.tick('pb', null)).resolves.toBe(true);
    expect(mockToggleItem).toHaveBeenCalledWith('pb', { itemId: 'jif-creamy' });
    expect(mockRecordPurchase).not.toHaveBeenCalled();
  });

  it("names the scanned barcode's record as what was bought, so the price lands on the product", async () => {
    mockToggleItem.mockResolvedValue(true);
    const { result } = renderCart([], [], { ...JIF, variationId: 'var-jif' });

    await result.current.tick('pb', null);

    expect(mockToggleItem).toHaveBeenCalledWith('pb', { variation: 'var-jif' });
  });

  it('records the total the sheet took as a price per unit', async () => {
    mockRecordPurchase.mockResolvedValue(true);
    const { result } = renderCart([]);

    await result.current.tick('pb', { quantity: 2, totalPrice: 7 });

    expect(mockRecordPurchase).toHaveBeenCalledWith(
      'pb',
      { purchasedQuantity: 2, purchasedPrice: 3.5 },
      { itemId: 'jif-creamy' },
    );
    expect(mockToggleItem).not.toHaveBeenCalled();
  });
});
