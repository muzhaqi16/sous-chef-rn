import { renderHook, act } from '@testing-library/react-native';
import { createApolloWrapper } from '../../../__tests__/helpers/apolloMockProvider';
import { useItemSelector } from '../useItemSelector';

// All tests in this file use type: 'custom', so every GraphQL query is skipped.
// The MockedProvider wrapper supplies the Apollo client context so useQuery
// hooks don't throw "no client" errors even though they never fire a request.
const wrapper = createApolloWrapper([]);

// Legacy non-pantry hooks (shopping list, home) still come through #generated
// during incremental migration. Their queries are skipped by type:'custom' too.
jest.mock('@apollo/client/react', () => ({
  ...jest.requireActual('@apollo/client/react'),
  useQuery: jest.fn((doc: any) => {
    const opName = doc?.definitions?.[0]?.name?.value;
    if (opName === 'GetShoppingListsLite')
      return {
        data: undefined,
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      };
    if (opName === 'GetHomes')
      return {
        data: undefined,
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      };
    return { data: undefined, loading: false, error: undefined };
  }),
}));

jest.mock('#hooks/apollo/usePreservedQueryData', () => ({
  usePreservedArrayData: <T>(data: T[] | undefined | null) => data ?? [],
}));

jest.mock('#utils/connectionUtils', () => ({
  extractNodes: (connection: any) =>
    connection?.edges?.map((e: any) => e.node) ?? [],
}));

jest.mock('#store/useAppStore', () => ({
  useAppStore: (selector: (state: any) => any) =>
    selector({ selectedHomeId: 'home-1' }),
  useSelectedHomeId: jest.fn(() => 'home-1'),
}));

describe('useItemSelector', () => {
  describe('custom type', () => {
    const customData = [
      { id: '1', name: 'Alpha' },
      { id: '2', name: 'Beta' },
      { id: '3', name: 'Charlie' },
    ];

    it('returns custom data and loading state', () => {
      const { result } = renderHook(
        () =>
          useItemSelector({ type: 'custom', customData, customLoading: true }),
        { wrapper },
      );

      expect(result.current.data).toEqual(customData);
      expect(result.current.loading).toBe(true);
    });

    it('returns empty array when customData is undefined', () => {
      const { result } = renderHook(() => useItemSelector({ type: 'custom' }), {
        wrapper,
      });

      expect(result.current.data).toEqual([]);
      expect(result.current.loading).toBe(false);
    });
  });

  describe('handleSelect', () => {
    it('updates selectedId and calls onSelect callback', () => {
      const onSelect = jest.fn();
      const { result } = renderHook(
        () =>
          useItemSelector({
            type: 'custom',
            customData: [{ id: '1', name: 'Test' }],
            onSelect,
          }),
        { wrapper },
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
      const { result } = renderHook(
        () =>
          useItemSelector({
            type: 'custom',
            customData: [{ id: '1', name: 'Test' }],
            initialSelected: '1',
          }),
        { wrapper },
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
      const { result } = renderHook(
        () =>
          useItemSelector({
            type: 'custom',
            customData: [],
            initialSelected: 'pre-selected',
          }),
        { wrapper },
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
        { initialProps: { initialSelected: 'a' }, wrapper },
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
    ])('returns correct message for type %s', (type, expected) => {
      const { result } = renderHook(
        () => useItemSelector({ type: type as any }),
        { wrapper },
      );

      expect(result.current.emptyMessage).toBe(expected);
    });
  });

  describe('setSelectedId', () => {
    it('exposes setSelectedId for direct control', () => {
      const { result } = renderHook(
        () => useItemSelector({ type: 'custom', customData: [] }),
        { wrapper },
      );

      act(() => {
        result.current.setSelectedId('direct-set');
      });

      expect(result.current.selectedId).toBe('direct-set');
    });
  });
});
