import { renderHook } from '@testing-library/react-native';
import { useShoppingListItemMutations } from '../useShoppingListItemMutations';

// --- Mocks ---

const mockAddItem = jest.fn();
const mockUpdateItem = jest.fn();
const mockRemoveItem = jest.fn();
const mockToggleItem = jest.fn();

jest.mock('../useAddShoppingItem', () => ({
  useAddShoppingItem: () => ({ addItem: mockAddItem }),
}));

jest.mock('../useUpdateShoppingItem', () => ({
  useUpdateShoppingItem: () => ({ updateItem: mockUpdateItem }),
}));

jest.mock('../useRemoveShoppingItem', () => ({
  useRemoveShoppingItem: () => ({ removeItem: mockRemoveItem }),
}));

jest.mock('../useToggleShoppingItem', () => ({
  useToggleShoppingItem: () => ({ toggleItem: mockToggleItem }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useShoppingListItemMutations', () => {
  const mockRefetch = jest.fn().mockResolvedValue(undefined);

  it('returns all four mutation functions', () => {
    const { result } = renderHook(() =>
      useShoppingListItemMutations('list-1', mockRefetch),
    );

    expect(result.current.addItem).toBe(mockAddItem);
    expect(result.current.updateItem).toBe(mockUpdateItem);
    expect(result.current.removeItem).toBe(mockRemoveItem);
    expect(result.current.toggleItem).toBe(mockToggleItem);
  });

  it('composes individual hooks together', () => {
    const { result } = renderHook(() =>
      useShoppingListItemMutations('list-1', mockRefetch),
    );

    expect(result.current).toEqual({
      addItem: mockAddItem,
      updateItem: mockUpdateItem,
      removeItem: mockRemoveItem,
      toggleItem: mockToggleItem,
    });
  });
});
