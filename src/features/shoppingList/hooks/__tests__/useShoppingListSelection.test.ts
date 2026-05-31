import { renderHook } from '@testing-library/react-native';
import { useShoppingListSelection } from '../useShoppingListSelection';
import type { ShoppingListFromQuery } from '../useShoppingListsQuery';

const mockSetSelectedShoppingListId = jest.fn();
let mockSelectedShoppingListId: string | null = null;

type MockState = {
  selectedShoppingListId: string | null;
  setSelectedShoppingListId: typeof mockSetSelectedShoppingListId;
};

jest.mock('zustand/react/shallow', () => ({
  useShallow: <S, U>(fn: (state: S) => U) => fn,
}));

jest.mock('#store/useAppStore', () => ({
  useAppStore: (selector: (state: MockState) => unknown) =>
    selector({
      selectedShoppingListId: mockSelectedShoppingListId,
      setSelectedShoppingListId: mockSetSelectedShoppingListId,
    }),
  useShoppingListState: jest.fn(() => ({
    selectedShoppingListId: mockSelectedShoppingListId,
    setSelectedShoppingListId: mockSetSelectedShoppingListId,
  })),
}));

function createList(
  overrides: Partial<ShoppingListFromQuery> & { id: string },
): ShoppingListFromQuery {
  return {
    __typename: 'ShoppingList',
    name: `List ${overrides.id}`,
    isDefault: false,
    totalItems: 0,
    completedItems: 0,
    homeId: null,
    home: null,
    ownerships: [],
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSelectedShoppingListId = null;
});

describe('useShoppingListSelection', () => {
  it('auto-selects the default list when no selection exists', () => {
    const lists = [
      createList({ id: 'list-1' }),
      createList({ id: 'list-2', isDefault: true }),
      createList({ id: 'list-3' }),
    ];

    renderHook(() => useShoppingListSelection(lists));

    expect(mockSetSelectedShoppingListId).toHaveBeenCalledWith('list-2');
  });

  it('auto-selects the first list when no default flag exists', () => {
    const lists = [createList({ id: 'list-1' }), createList({ id: 'list-2' })];

    renderHook(() => useShoppingListSelection(lists));

    expect(mockSetSelectedShoppingListId).toHaveBeenCalledWith('list-1');
  });

  it('preserves valid existing selection', () => {
    mockSelectedShoppingListId = 'list-2';
    const lists = [
      createList({ id: 'list-1' }),
      createList({ id: 'list-2' }),
      createList({ id: 'list-3' }),
    ];

    const { result } = renderHook(() => useShoppingListSelection(lists));

    // Should NOT call setSelectedShoppingListId since selection is valid
    expect(mockSetSelectedShoppingListId).not.toHaveBeenCalled();
    expect(result.current.currentListId).toBe('list-2');
  });

  it('returns currentListId from valid selection', () => {
    mockSelectedShoppingListId = 'list-2';
    const lists = [createList({ id: 'list-1' }), createList({ id: 'list-2' })];

    const { result } = renderHook(() => useShoppingListSelection(lists));

    expect(result.current.currentListId).toBe('list-2');
  });

  it('falls back to default list when selected id is not in lists', () => {
    mockSelectedShoppingListId = 'deleted-list';
    const lists = [
      createList({ id: 'list-1' }),
      createList({ id: 'list-2', isDefault: true }),
    ];

    const { result } = renderHook(() => useShoppingListSelection(lists));

    // currentListId should fall back to default
    expect(result.current.currentListId).toBe('list-2');
    // Auto-select should fire
    expect(mockSetSelectedShoppingListId).toHaveBeenCalledWith('list-2');
  });

  it('returns defaultList — the list with isDefault flag', () => {
    const lists = [
      createList({ id: 'list-1' }),
      createList({ id: 'list-2', isDefault: true }),
    ];

    const { result } = renderHook(() => useShoppingListSelection(lists));

    expect(result.current.defaultList?.id).toBe('list-2');
  });

  it('returns first list as defaultList when no isDefault flag', () => {
    const lists = [createList({ id: 'list-1' }), createList({ id: 'list-2' })];

    const { result } = renderHook(() => useShoppingListSelection(lists));

    expect(result.current.defaultList?.id).toBe('list-1');
  });

  it('does not auto-select when lists array is empty', () => {
    renderHook(() => useShoppingListSelection([]));

    expect(mockSetSelectedShoppingListId).not.toHaveBeenCalled();
  });

  it('exposes setSelectedShoppingListId for manual selection', () => {
    const lists = [createList({ id: 'list-1' })];

    const { result } = renderHook(() => useShoppingListSelection(lists));

    expect(result.current.setSelectedShoppingListId).toBe(
      mockSetSelectedShoppingListId,
    );
  });

  it('returns currentList object matching currentListId', () => {
    mockSelectedShoppingListId = 'list-2';
    const lists = [
      createList({ id: 'list-1', name: 'Groceries' }),
      createList({ id: 'list-2', name: 'Weekly' }),
    ];

    const { result } = renderHook(() => useShoppingListSelection(lists));

    expect(result.current.currentList?.name).toBe('Weekly');
  });
});
