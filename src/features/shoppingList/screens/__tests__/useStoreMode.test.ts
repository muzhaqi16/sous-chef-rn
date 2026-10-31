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

const mockPermissions = { canEditItems: false, canEditList: false };
jest.mock('../../hooks/useShoppingListPermissions', () => ({
  useShoppingListPermissions: () => ({ ...mockPermissions, resolved: true }),
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

// The server's sum of what is left; store mode only words it.
let mockCostToGo: {
  amount: number | null;
  currency: string;
  pricedLines: number;
  lines: number;
} | null = null;
jest.mock('../../hooks/useListCostToGo', () => ({
  ...jest.requireActual<typeof import('../../hooks/useListCostToGo')>(
    '../../hooks/useListCostToGo',
  ),
  useListCostToGo: () => mockCostToGo,
}));

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

  it("reads what is left from the list's cost to go", () => {
    mockCostToGo = { amount: 6, currency: 'USD', pricedLines: 2, lines: 3 };
    const { result } = renderHook(() => useStoreMode('list-1'));

    expect(result.current.state.estimate).toEqual({
      price: formatCurrency(6, 'USD'),
      priced: 2,
      lines: 3,
    });
  });

  it('has no estimate while nothing left is priced, or the list is unread', () => {
    mockCostToGo = { amount: null, currency: 'USD', pricedLines: 0, lines: 3 };
    expect(
      renderHook(() => useStoreMode('list-1')).result.current.state.estimate,
    ).toBeNull();

    mockCostToGo = null;
    expect(
      renderHook(() => useStoreMode('list-1')).result.current.state.estimate,
    ).toBeNull();
  });

  it('walks the aisles in the route order', () => {
    const { result } = renderHook(() => useStoreMode('list-1'));

    expect(result.current.state.aisles.map(aisle => aisle.department)).toEqual(
      ROUTE,
    );
  });

  it('offers the store choice to whoever may edit the list, not its items', () => {
    mockPermissions.canEditItems = true;
    mockPermissions.canEditList = false;
    const { result, rerender } = renderHook(() => useStoreMode('list-1'));
    expect(result.current.state.canChooseStore).toBe(false);

    mockPermissions.canEditItems = false;
    mockPermissions.canEditList = true;
    rerender({});
    expect(result.current.state.canChooseStore).toBe(true);
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
