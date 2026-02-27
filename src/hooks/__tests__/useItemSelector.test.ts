import { renderHook, act } from '@testing-library/react-native';
import { useItemSelector } from '../useItemSelector';

// Mock GraphQL queries — all skipped for 'custom' type tests
jest.mock('#generated', () => ({
  useGetShoppingListsLiteQuery: jest.fn(() => ({
    data: undefined,
    loading: false,
  })),
  useGetPantriesQuery: jest.fn(() => ({
    data: undefined,
    loading: false,
  })),
  useGetHomesQuery: jest.fn(() => ({
    data: undefined,
    loading: false,
  })),
}));

jest.mock('#hooks/apollo/usePreservedQueryData', () => ({
  usePreservedArrayData: <T,>(data: T[] | undefined | null) => data ?? [],
}));

jest.mock('#utils/connectionUtils', () => ({
  extractNodes: (connection: any) =>
    connection?.edges?.map((e: any) => e.node) ?? [],
}));

jest.mock('#store/useAppStore', () => ({
  useAppStore: (selector: (state: any) => any) =>
    selector({ selectedHomeId: 'home-1' }),
  selectSelectedHomeId: (state: any) => state.selectedHomeId,
}));

describe('useItemSelector', () => {
  describe('custom type', () => {
    const customData = [
      { id: '1', name: 'Alpha' },
      { id: '2', name: 'Beta' },
      { id: '3', name: 'Charlie' },
    ];

    it('returns custom data and loading state', () => {
      const { result } = renderHook(() =>
        useItemSelector({ type: 'custom', customData, customLoading: true }),
      );

      expect(result.current.data).toEqual(customData);
      expect(result.current.loading).toBe(true);
    });

    it('returns empty array when customData is undefined', () => {
      const { result } = renderHook(() =>
        useItemSelector({ type: 'custom' }),
      );

      expect(result.current.data).toEqual([]);
      expect(result.current.loading).toBe(false);
    });
  });

  describe('handleSelect', () => {
    it('updates selectedId and calls onSelect callback', () => {
      const onSelect = jest.fn();
      const { result } = renderHook(() =>
        useItemSelector({
          type: 'custom',
          customData: [{ id: '1', name: 'Test' }],
          onSelect,
        }),
      );

      act(() => {
        result.current.handleSelect('1', { id: '1', name: 'Test' });
      });

      expect(result.current.selectedId).toBe('1');
      expect(onSelect).toHaveBeenCalledWith('1', { id: '1', name: 'Test' });
    });
  });

  describe('reset', () => {
    it('clears selectedId', () => {
      const { result } = renderHook(() =>
        useItemSelector({
          type: 'custom',
          customData: [{ id: '1', name: 'Test' }],
          initialSelected: '1',
        }),
      );

      expect(result.current.selectedId).toBe('1');

      act(() => {
        result.current.reset();
      });

      expect(result.current.selectedId).toBeUndefined();
    });
  });

  describe('initialSelected', () => {
    it('sets selectedId from initialSelected prop', () => {
      const { result } = renderHook(() =>
        useItemSelector({
          type: 'custom',
          customData: [],
          initialSelected: 'pre-selected',
        }),
      );

      expect(result.current.selectedId).toBe('pre-selected');
    });

    it('syncs when initialSelected changes', () => {
      const { result, rerender } = renderHook(
        (props: { initialSelected: string }) =>
          useItemSelector({
            type: 'custom',
            customData: [],
            initialSelected: props.initialSelected,
          }),
        { initialProps: { initialSelected: 'a' } },
      );

      expect(result.current.selectedId).toBe('a');

      rerender({ initialSelected: 'b' });

      expect(result.current.selectedId).toBe('b');
    });
  });

  describe('emptyMessage', () => {
    it.each([
      ['shoppingList', 'No shopping lists available'],
      ['pantry', 'No pantries available'],
      ['home', 'No homes available'],
      ['custom', 'No items available'],
    ] as const)('returns correct message for type %s', (type, expected) => {
      const { result } = renderHook(() =>
        useItemSelector({ type: type as any }),
      );

      expect(result.current.emptyMessage).toBe(expected);
    });
  });

  describe('setSelectedId', () => {
    it('exposes setSelectedId for direct control', () => {
      const { result } = renderHook(() =>
        useItemSelector({ type: 'custom', customData: [] }),
      );

      act(() => {
        result.current.setSelectedId('direct-set');
      });

      expect(result.current.selectedId).toBe('direct-set');
    });
  });
});
