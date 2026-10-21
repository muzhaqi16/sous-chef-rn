import { act, renderHook } from '@testing-library/react-native';
import { StoreDepartment } from '#/graphql/generated/schemaTypes';
import { formatCurrency } from '#/utils/formatters/number';
import { useStoreMode } from '../useStoreMode';

const ROUTE = [
  StoreDepartment.Produce,
  StoreDepartment.DairyEggs,
  StoreDepartment.Frozen,
];

jest.mock('#store/useAppStore', () => ({
  useUser: () => ({ id: 'user-1' }),
}));

jest.mock('../useAisleView', () => {
  const { groupByAisle } = jest.requireActual<
    typeof import('#features/shoppingList/components/SortableShoppingList/aisleRows')
  >('#features/shoppingList/components/SortableShoppingList/aisleRows');
  return {
    useAisleView: (_list: string, _store: unknown, rows: never) => ({
      aisleEntries: groupByAisle(rows, ['PRODUCE', 'DAIRY_EGGS', 'FROZEN']),
      routeNote: null,
    }),
  };
});

jest.mock('../../hooks/useShoppingListPermissions', () => ({
  useShoppingListPermissions: () => ({ resolved: true }),
}));

jest.mock('../../hooks/useShoppingListActions', () => ({
  useShoppingListActions: () => ({ handleTogglePurchase: jest.fn() }),
}));

const mockUpdateShoppingList = jest.fn();
jest.mock('../../hooks/mutations/useUpdateShoppingList', () => ({
  useUpdateShoppingList: () => ({ updateShoppingList: mockUpdateShoppingList }),
}));

const mockToastError = jest.fn();
jest.mock('#/services/toastService', () => ({
  toastService: { error: (message: string) => mockToastError(message) },
}));

interface Line {
  id: string;
  itemName: string;
  quantity: number;
  sortOrder: string;
  storeDepartment: StoreDepartment;
  priceEstimate: { estimated: number | null };
  suggestedPrice: {
    amount: number;
    currency: { code: string; decimalPlaces: number };
  } | null;
}

const line = (
  id: string,
  storeDepartment: StoreDepartment,
  price: { amount: number; code?: string } | null = null,
  quantity = 1,
  estimated: number | null = null,
): Line => ({
  id,
  itemName: id,
  quantity,
  sortOrder: id,
  storeDepartment,
  priceEstimate: { estimated },
  suggestedPrice: price && {
    amount: price.amount,
    currency: { code: price.code ?? 'USD', decimalPlaces: 2 },
  },
});

const list = {
  lines: [] as Line[],
  cart: [] as Line[],
};

jest.mock('../../hooks/useShoppingListManagement', () => ({
  useShoppingListManagement: () => ({
    shoppingList: { id: 'list-1', name: 'Groceries', targetStore: null },
    rawUnpurchasedItems: list.lines,
    rawPurchasedItems: list.cart,
    loading: false,
    error: undefined,
    totalCountUnpurchased: list.lines.length,
    totalCountPurchased: list.cart.length,
    loadMorePurchased: jest.fn(),
    removeItem: jest.fn(),
    toggleItem: jest.fn(),
    recordPurchase: jest.fn(),
    refetch: jest.fn(),
  }),
}));

const apples = line('apples', StoreDepartment.Produce, { amount: 1.5 }, 2);
const milk = line('milk', StoreDepartment.DairyEggs, { amount: 3 });
const peas = line('peas', StoreDepartment.Frozen);

const ids = (rows: { id: string }[]) => rows.map(row => row.id);

describe('useStoreMode', () => {
  beforeEach(() => {
    list.lines = [apples, milk, peas];
    list.cart = [];
  });

  it('opens the next aisle on the walk once the open one is done', () => {
    const { result, rerender } = renderHook(() => useStoreMode('list-1'));

    act(() => result.current.actions.setTab(StoreDepartment.DairyEggs));
    expect(ids(result.current.state.rows)).toEqual(['milk']);

    // Milk is ticked: its aisle empties.
    list.lines = [apples, peas];
    list.cart = [milk];
    rerender({});

    expect(result.current.state.tab).toBe(StoreDepartment.Frozen);
    expect(ids(result.current.state.rows)).toEqual(['peas']);
  });

  it('shows what is in the cart, to untick', () => {
    list.cart = [line('bread', StoreDepartment.Bakery)];
    const { result } = renderHook(() => useStoreMode('list-1'));

    act(() => result.current.actions.setTab('cart'));

    expect(ids(result.current.state.rows)).toEqual(['bread']);
    expect(result.current.state.cartCount).toBe(1);
    expect(result.current.state.totalCount).toBe(4);
  });

  it('adds up what is left at recorded prices, line by line', () => {
    const { result } = renderHook(() => useStoreMode('list-1'));

    expect(result.current.state.estimate).toEqual({
      price: formatCurrency(6, 'USD', 2),
      priced: 2,
      lines: 3,
    });
  });

  it('counts a typed estimate before the recorded price, as the API totals a list', () => {
    list.lines = [
      line('apples', StoreDepartment.Produce, { amount: 1.5 }, 2, 2),
      milk,
      line('peas', StoreDepartment.Frozen, null, 1, 2.5),
    ];
    const { result } = renderHook(() => useStoreMode('list-1'));

    // 2 × 2 typed, over the 1.50 recorded; 3 recorded; 2.50 typed.
    expect(result.current.state.estimate).toEqual({
      price: formatCurrency(9.5, 'USD', 2),
      priced: 3,
      lines: 3,
    });
  });

  it('gives no one total across currencies', () => {
    list.lines = [
      apples,
      line('cheese', StoreDepartment.Deli, { amount: 4, code: 'EUR' }),
    ];
    const { result } = renderHook(() => useStoreMode('list-1'));

    expect(result.current.state.estimate).toBeNull();
  });

  it('walks the aisles in the route order', () => {
    const { result } = renderHook(() => useStoreMode('list-1'));

    expect(result.current.state.aisles.map(aisle => aisle.department)).toEqual(
      ROUTE,
    );
  });

  it("sets the list's store from the trip", async () => {
    mockUpdateShoppingList.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useStoreMode('list-1'));

    await act(() =>
      result.current.actions.chooseStore({ id: 'store-1', name: 'Aldi' }),
    );

    expect(mockUpdateShoppingList).toHaveBeenCalledWith('list-1', {
      targetStore: { id: 'store-1', name: 'Aldi' },
    });
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('says so when the store could not be saved', async () => {
    mockUpdateShoppingList.mockRejectedValueOnce(new Error('refused'));
    const { result } = renderHook(() => useStoreMode('list-1'));

    await act(() =>
      result.current.actions.chooseStore({ id: 'store-1', name: 'Aldi' }),
    );

    expect(mockToastError).toHaveBeenCalledWith('Failed to save settings');
  });
});
