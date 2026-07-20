import { act } from '@testing-library/react-native';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { DisplayFormat } from '#/graphql/generated/schemaTypes';
import { type ShoppingListItemDisplayFragment } from '#features/shoppingList/graphql/shoppingListFragments.generated';
import { usePurchaseAmountModal } from '../usePurchaseAmountModal';

const makeItem = (
  overrides: Partial<ShoppingListItemDisplayFragment> = {},
): ShoppingListItemDisplayFragment => ({
  __typename: 'ShoppingListItem',
  id: 'item-1',
  itemName: 'Milk',
  quantity: 2,
  quantityInput: '2',
  displayFormat: DisplayFormat.Decimal,
  version: 1,
  updatedAt: '2026-01-01T00:00:00.000Z',
  category: null,
  notes: null,
  unitName: 'L',
  sortOrder: '1',
  purchaseInfo: {
    __typename: 'ShoppingListItemPurchaseInfo',
    isPurchased: false,
  },
  unit: { __typename: 'Unit', id: 'u1', name: 'Liter', symbol: 'L' },
  item: null,
  ...overrides,
});

// No cache is seeded, so useFragment stays `complete: false` and the hook reads
// the item from the passed `items` snapshot — exactly the open path under test.
const setup = (
  items: ShoppingListItemDisplayFragment[],
  recordPurchase = jest.fn().mockResolvedValue(true),
) =>
  renderHookWithApollo(() => usePurchaseAmountModal({ items, recordPurchase }));

describe('usePurchaseAmountModal', () => {
  it('is closed with no selection initially', () => {
    const { result } = setup([makeItem()]);
    expect(result.current.visible).toBe(false);
    expect(result.current.selectedItem).toBeNull();
  });

  it('opens for an item and populates selectedItem from the snapshot', () => {
    const { result } = setup([makeItem()]);

    act(() => {
      result.current.openForItem('item-1');
    });

    expect(result.current.visible).toBe(true);
    expect(result.current.selectedItem).toEqual(
      expect.objectContaining({
        id: 'item-1',
        itemName: 'Milk',
        requestedQuantity: 2,
        unitName: 'L',
        estimatedPrice: null,
      }),
    );
  });

  it('does not open for an unknown item id', () => {
    const { result } = setup([makeItem()]);

    act(() => {
      result.current.openForItem('does-not-exist');
    });

    expect(result.current.visible).toBe(false);
    expect(result.current.selectedItem).toBeNull();
  });

  it('confirm records the entered amounts, then closes', async () => {
    const recordPurchase = jest.fn().mockResolvedValue(true);
    const { result } = setup([makeItem()], recordPurchase);

    act(() => {
      result.current.openForItem('item-1');
    });
    await act(async () => {
      await result.current.confirm(3, 5.5);
    });

    expect(recordPurchase).toHaveBeenCalledWith('item-1', {
      purchasedQuantity: 3,
      purchasedPrice: 5.5,
    });
    expect(result.current.visible).toBe(false);
    expect(result.current.selectedItem).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('close (skip / dismiss) resets state without recording', () => {
    const recordPurchase = jest.fn();
    const { result } = setup([makeItem()], recordPurchase);

    act(() => {
      result.current.openForItem('item-1');
    });
    act(() => {
      result.current.close();
    });

    expect(result.current.visible).toBe(false);
    expect(result.current.selectedItem).toBeNull();
    expect(recordPurchase).not.toHaveBeenCalled();
  });

  it("falls back to the localized 'Item' name when itemName is empty", () => {
    const { result } = setup([makeItem({ itemName: '' })]);

    act(() => {
      result.current.openForItem('item-1');
    });

    expect(result.current.selectedItem?.itemName).toBe('Item');
  });
});
