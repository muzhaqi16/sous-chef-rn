'use no memo';

import { renderHook, act } from '@testing-library/react-native';
import { usePantrySorting } from '../usePantrySorting';
import {
  PantrySortOption,
  PantrySortDirection,
} from '#store/slices/preferenceTypes';

interface TestItem {
  id: string;
  itemName?: string | null;
  expiresAt?: string | null;
  quantity: number;
  createdAt?: string;
}

const makeItem = (
  overrides: Partial<TestItem> & { id: string; quantity: number },
): TestItem => ({
  itemName: null,
  expiresAt: null,
  createdAt: undefined,
  ...overrides,
});

describe('usePantrySorting', () => {
  it('returns default sort option and direction', () => {
    const { result } = renderHook(() => usePantrySorting());
    expect(result.current.sortOption).toBe('recent');
    expect(result.current.sortDirection).toBe('desc');
    expect(result.current.sortModalVisible).toBe(false);
  });

  it('respects initial sort options', () => {
    const { result } = renderHook(() =>
      usePantrySorting({
        initialSortOption: PantrySortOption.NAME,
        initialSortDirection: PantrySortDirection.ASC,
      }),
    );
    expect(result.current.sortOption).toBe('name');
    expect(result.current.sortDirection).toBe('asc');
  });

  it('opens and closes the sort modal', () => {
    const { result } = renderHook(() => usePantrySorting());

    act(() => {
      result.current.openSortModal();
    });
    expect(result.current.sortModalVisible).toBe(true);

    act(() => {
      result.current.closeSortModal();
    });
    expect(result.current.sortModalVisible).toBe(false);
  });

  it('toggles direction when selecting the same sort option', () => {
    const onSortChange = jest.fn();
    const { result } = renderHook(() =>
      usePantrySorting({
        initialSortOption: PantrySortOption.NAME,
        initialSortDirection: PantrySortDirection.ASC,
        onSortChange,
      }),
    );

    act(() => {
      result.current.handleSortSelect(PantrySortOption.NAME);
    });
    expect(result.current.sortDirection).toBe('desc');
    expect(onSortChange).toHaveBeenCalledWith('name', 'desc');
    expect(result.current.sortModalVisible).toBe(false);
  });

  it('resets direction to asc when selecting a different sort option', () => {
    const onSortChange = jest.fn();
    const { result } = renderHook(() =>
      usePantrySorting({
        initialSortOption: PantrySortOption.NAME,
        initialSortDirection: PantrySortDirection.DESC,
        onSortChange,
      }),
    );

    act(() => {
      result.current.handleSortSelect(PantrySortOption.QUANTITY);
    });
    expect(result.current.sortOption).toBe('quantity');
    expect(result.current.sortDirection).toBe('asc');
    expect(onSortChange).toHaveBeenCalledWith('quantity', 'asc');
  });

  it('sorts items by name ascending', () => {
    const { result } = renderHook(() =>
      usePantrySorting<TestItem>({
        initialSortOption: PantrySortOption.NAME,
        initialSortDirection: PantrySortDirection.ASC,
      }),
    );

    const items: TestItem[] = [
      makeItem({ id: '1', itemName: 'Cheese', quantity: 1 }),
      makeItem({ id: '2', itemName: 'Apple', quantity: 2 }),
      makeItem({ id: '3', itemName: 'Banana', quantity: 3 }),
    ];

    const sorted = result.current.sortItems(items);
    expect(sorted.map(i => i.itemName)).toEqual(['Apple', 'Banana', 'Cheese']);
  });

  it('sorts items by quantity descending', () => {
    const { result } = renderHook(() =>
      usePantrySorting<TestItem>({
        initialSortOption: PantrySortOption.QUANTITY,
        initialSortDirection: PantrySortDirection.DESC,
      }),
    );

    const items: TestItem[] = [
      makeItem({ id: '1', quantity: 5 }),
      makeItem({ id: '2', quantity: 10 }),
      makeItem({ id: '3', quantity: 1 }),
    ];

    const sorted = result.current.sortItems(items);
    expect(sorted.map(i => i.quantity)).toEqual([10, 5, 1]);
  });

  it('sorts items by expiry with missing dates pushed to end', () => {
    const { result } = renderHook(() =>
      usePantrySorting<TestItem>({
        initialSortOption: PantrySortOption.EXPIRY,
        initialSortDirection: PantrySortDirection.ASC,
      }),
    );

    const items: TestItem[] = [
      makeItem({ id: '1', expiresAt: null, quantity: 1 }),
      makeItem({ id: '2', expiresAt: '2025-01-01', quantity: 1 }),
      makeItem({ id: '3', expiresAt: '2024-06-01', quantity: 1 }),
    ];

    const sorted = result.current.sortItems(items);
    expect(sorted.map(i => i.id)).toEqual(['3', '2', '1']);
  });

  it('sorts items by recent (createdAt) ascending shows most recent first', () => {
    const { result } = renderHook(() =>
      usePantrySorting<TestItem>({
        initialSortOption: PantrySortOption.RECENT,
        initialSortDirection: PantrySortDirection.ASC,
      }),
    );

    const items: TestItem[] = [
      makeItem({ id: '1', createdAt: '2024-01-01', quantity: 1 }),
      makeItem({ id: '2', createdAt: '2024-06-01', quantity: 1 }),
      makeItem({ id: '3', createdAt: '2024-03-01', quantity: 1 }),
    ];

    // 'recent' sort base comparison is b - a (most recent first)
    // with 'asc' direction, comparison is kept as-is
    const sorted = result.current.sortItems(items);
    expect(sorted.map(i => i.id)).toEqual(['2', '3', '1']);
  });
});
