import type { Unmasked } from '@apollo/client/masking';
import { useApolloClient } from '@apollo/client/react';
import { act } from '@testing-library/react-native';
import {
  completeMockedResponse,
  renderHookWithApollo,
  seedCache,
  seedFragment,
  seedQuery,
} from '#/test-utils/apolloMockProvider';
import {
  GetShoppingListItemsFilteredDocument,
  type GetShoppingListItemsFilteredQuery,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { PAGINATION } from '#features/shoppingList/utils/shoppingListConstants';
import { useStoreModeCart } from '../useStoreModeCart';
import { UseListCurrency_ListFragmentDoc } from '../useListCurrency.generated';
import { asAbbreviation } from '#/test-utils/fixtures/unitLabels';

const mockClaimPurchased = jest.fn();
const mockRecordPurchase = jest.fn();
// What a refused tick runs to re-read the list.
let mockRefetchOnRefusal: () => Promise<unknown> = async () => {};
jest.mock('../mutations/useToggleShoppingItem', () => ({
  useToggleShoppingItem: (options: { refetch: () => Promise<unknown> }) => {
    mockRefetchOnRefusal = options.refetch;
    return {
      claimPurchased: (...args: unknown[]) => mockClaimPurchased(...args),
      recordPurchase: (...args: unknown[]) => mockRecordPurchase(...args),
    };
  },
}));

const LIST = 'list-1';
const JIF = { id: 'jif-creamy', conceptIds: ['peanut-butter'] };

interface LineSeed {
  id: string;
  itemId: string;
  itemName: string;
  estimated?: number | null;
  suggested?: number | null;
  suggestedIn?: string;
  unitId?: string;
}

const node = ({
  id,
  itemId,
  itemName,
  estimated = null,
  suggested = null,
  suggestedIn = 'USD',
  unitId,
}: LineSeed) => ({
  __typename: 'ShoppingListItem',
  version: 1,
  id,
  itemName,
  quantity: 2,
  unitName: 'jar',
  unit: unitId
    ? asAbbreviation({
        __typename: 'Unit',
        id: unitId,
        name: 'jar',
        symbol: 'jar',
      })
    : null,
  priceEstimate: { __typename: 'ShoppingListItemPriceEstimate', estimated },
  suggestedPrice:
    suggested === null
      ? null
      : {
          __typename: 'PriceSuggestion',
          amount: suggested,
          currency: { __typename: 'Currency', code: suggestedIn },
        },
  item: { __typename: 'Item', version: 1, id: itemId },
});

const tabVariables = (isPurchased: boolean) => ({
  id: LIST,
  first: PAGINATION.ITEMS_PAGE_SIZE,
  isPurchased,
});

/** The server's answer for one tab of the list. */
const tabResponse = (isPurchased: boolean, lines: LineSeed[]) => ({
  request: {
    query: GetShoppingListItemsFilteredDocument,
    variables: tabVariables(isPurchased),
  },
  result: {
    data: {
      shoppingList: {
        __typename: 'ShoppingList',
        version: 1,
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
});

/** Writes one tab of the list the way store mode's own read left it. */
function seedTab(
  cache: ReturnType<typeof seedCache>,
  isPurchased: boolean,
  lines: LineSeed[],
) {
  const variables = tabVariables(isPurchased);
  const completed = completeMockedResponse(tabResponse(isPurchased, lines))
    .result as (vars: typeof variables) => {
    data: Unmasked<GetShoppingListItemsFilteredQuery>;
  };
  seedQuery(cache, {
    query: GetShoppingListItemsFilteredDocument,
    variables,
    data: completed(variables).data,
  });
}

/** The list as the device holds it once store mode has read it. */
const seedList = (cache: ReturnType<typeof seedCache>, currency = 'USD') =>
  seedFragment(cache, {
    fragment: UseListCurrency_ListFragmentDoc,
    data: { __typename: 'ShoppingList', version: 1, id: LIST, currency },
  });

function renderCart(
  toBuy: LineSeed[],
  inCart: LineSeed[] = [],
  scanned: Parameters<typeof useStoreModeCart>[1] = JIF,
  listCurrency = 'USD',
) {
  const cache = seedCache([]);
  seedTab(cache, false, toBuy);
  seedTab(cache, true, inCart);
  seedList(cache, listCurrency);
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

    expect(result.current.unit).toEqual(
      expect.objectContaining({ id: 'unit-jar', symbol: 'jar' }),
    );
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

  it("hints no suggestion priced in another currency than the list's", () => {
    const line = {
      id: 'pb',
      itemId: 'jif-creamy',
      itemName: 'Jif',
      suggested: 3.49,
      suggestedIn: 'EUR',
    };

    expect(renderCart([line]).result.current.line?.estimatedPrice).toBeNull();
    expect(
      renderCart([line], [], JIF, 'EUR').result.current.line?.estimatedPrice,
    ).toBe(3.49);
  });

  it('reports a product already in the cart, with no line to tick', () => {
    const { result } = renderCart(
      [],
      [{ id: 'pb', itemId: 'peanut-butter', itemName: 'Peanut butter' }],
    );

    expect(result.current.line).toBeNull();
    expect(result.current.inCart).toBe(true);
  });

  // A claim, not a flip: a line another member ticked stays in the cart.
  it('ticks with no price by claiming the line purchased', async () => {
    mockClaimPurchased.mockResolvedValue(true);
    const { result } = renderCart([]);

    await expect(result.current.tick('pb', null)).resolves.toBe(true);
    expect(mockClaimPurchased).toHaveBeenCalledWith('pb', {
      itemId: 'jif-creamy',
    });
    expect(mockRecordPurchase).not.toHaveBeenCalled();
  });

  it("names the scanned barcode's record as what was bought, so the price lands on the product", async () => {
    mockClaimPurchased.mockResolvedValue(true);
    const { result } = renderCart([], [], { ...JIF, variationId: 'var-jif' });

    await result.current.tick('pb', null);

    expect(mockClaimPurchased).toHaveBeenCalledWith('pb', {
      variation: 'var-jif',
    });
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
    expect(mockClaimPurchased).not.toHaveBeenCalled();
  });

  // Store mode loaded every line; a fetch through this read would page its
  // lines back to the first page.
  it('asks the network for neither tab when the app resyncs', async () => {
    const cache = seedCache([]);
    seedTab(cache, false, [
      { id: 'pb', itemId: 'jif-creamy', itemName: 'Jif' },
    ]);
    seedTab(cache, true, []);
    seedList(cache);
    const { result } = renderHookWithApollo(
      () => ({ cart: useStoreModeCart(LIST, JIF), client: useApolloClient() }),
      { cache, operationMocks: [] },
    );
    expect(result.current.cart.line?.id).toBe('pb');

    const resync = result.current.client.refetchQueries({ include: 'active' });
    await resync;

    expect(resync.queries).toHaveLength(0);
  });

  it('re-reads both tabs from the server after a refused tick', async () => {
    const cache = seedCache([]);
    seedTab(cache, false, [
      { id: 'pb', itemId: 'jif-creamy', itemName: 'Jif' },
    ]);
    seedTab(cache, true, []);
    seedList(cache);
    const { result } = renderHookWithApollo(() => useStoreModeCart(LIST, JIF), {
      cache,
      operationMocks: [
        tabResponse(false, []),
        tabResponse(true, [
          { id: 'pb', itemId: 'jif-creamy', itemName: 'Jif' },
        ]),
      ],
    });
    expect(result.current.inCart).toBe(false);

    await act(async () => {
      await mockRefetchOnRefusal();
    });

    expect(result.current.inCart).toBe(true);
  });
});
