import { renderHook } from '@testing-library/react-native';
import { useShoppingListItemMutations } from '../useShoppingListItemMutations';

// --- Mocks ---

const mockRemoveItem = jest.fn();
const mockToggleItem = jest.fn();

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

  it('returns the remove and toggle mutation functions', () => {
    const { result } = renderHook(() =>
      useShoppingListItemMutations('list-1', mockRefetch),
    );

    expect(result.current.removeItem).toBe(mockRemoveItem);
    expect(result.current.toggleItem).toBe(mockToggleItem);
  });

  it('composes individual hooks together', () => {
    const { result } = renderHook(() =>
      useShoppingListItemMutations('list-1', mockRefetch),
    );

    expect(result.current).toEqual({
      removeItem: mockRemoveItem,
      toggleItem: mockToggleItem,
    });
  });
});
