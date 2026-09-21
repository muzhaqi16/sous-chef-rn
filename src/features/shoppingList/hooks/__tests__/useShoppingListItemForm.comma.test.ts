/**
 * The form on a comma-decimal device, against the real parsers — the sibling
 * suite stubs `parseFractionalInput` with a period-only reader.
 */
import { renderHook, act } from '@testing-library/react-native';
import { getDeviceDecimalSeparator } from '#/utils/deviceLocale';
import { useShoppingListItemForm } from '../useShoppingListItemForm';
import type { UseShoppingListItemForm_ItemFragment } from '../useShoppingListItemForm.generated';

jest.mock('#/utils/deviceLocale', () => ({
  ...jest.requireActual('#/utils/deviceLocale'),
  getDeviceDecimalSeparator: jest.fn(() => ','),
}));

function storedItem(
  overrides: Partial<UseShoppingListItemForm_ItemFragment> = {},
): UseShoppingListItemForm_ItemFragment {
  return {
    __typename: 'ShoppingListItem',
    id: 'sli-1',
    version: 1,
    itemName: 'Flour',
    quantity: 1,
    quantityInput: '1',
    unitName: 'kg',
    notes: '',
    category: '',
    unit: null,
    priceEstimate: { __typename: 'PriceEstimate', estimated: null },
    priority: 0,
    storeInfo: {
      __typename: 'ShoppingListItemStoreInfo',
      preferredStore: null,
    },
    brand: null,
    netWeight: null,
    netWeightUnit: null,
    ...overrides,
  };
}

describe('useShoppingListItemForm on a comma-decimal device', () => {
  beforeEach(() => {
    jest.mocked(getDeviceDecimalSeparator).mockReturnValue(',');
  });

  it('seeds stored API text as the same quantity', () => {
    const { result } = renderHook(() => useShoppingListItemForm());

    act(() => {
      result.current.setFromItem(
        storedItem({ quantity: 1.15, quantityInput: '1.150' }),
      );
    });

    expect(result.current.values.quantityInput).toBe('1,15');
  });

  it('seeds a stored cooking fraction as that fraction', () => {
    const { result } = renderHook(() => useShoppingListItemForm());

    act(() => {
      result.current.setFromItem(
        storedItem({ quantity: 1.25, quantityInput: '1.250' }),
      );
    });

    expect(result.current.values.quantityInput).toBe('1 1/4');
  });

  it('sends an edited quantity as API text', () => {
    const { result } = renderHook(() => useShoppingListItemForm());

    act(() => {
      result.current.setFromItem(storedItem());
    });
    act(() => {
      result.current.setFieldValue('quantityInput', '2,2');
    });

    expect(result.current.buildDirtyInput().quantity).toBe('2.2');
  });
});
