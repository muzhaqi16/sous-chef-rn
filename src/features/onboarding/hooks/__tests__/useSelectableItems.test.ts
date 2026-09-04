import { renderHook, act } from '@testing-library/react-native';
import { useSelectableItems, SelectableItem } from '../useSelectableItems';
import { logger } from '#/utils/environment';

interface TestItem extends SelectableItem {
  name: string;
}

const createItems = (count: number, selectedIds: string[] = []): TestItem[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `item-${i + 1}`,
    name: `Item ${i + 1}`,
    selected: selectedIds.includes(`item-${i + 1}`),
  }));

describe('useSelectableItems', () => {
  it('returns initial items unchanged', () => {
    const items = createItems(3);
    const { result } = renderHook(() =>
      useSelectableItems({ initialItems: items }),
    );

    expect(result.current.items).toHaveLength(3);
    expect(result.current.selectedItems).toHaveLength(0);
    expect(result.current.isMaxReached).toBe(false);
  });

  it('includes pre-selected items in selectedItems', () => {
    const items = createItems(3, ['item-1', 'item-3']);
    const { result } = renderHook(() =>
      useSelectableItems({ initialItems: items }),
    );

    expect(result.current.selectedItems).toHaveLength(2);
    expect(result.current.selectedItems.map(i => i.id)).toEqual([
      'item-1',
      'item-3',
    ]);
  });

  describe('toggleItem', () => {
    it('selects an unselected item', () => {
      const items = createItems(3);
      const { result } = renderHook(() =>
        useSelectableItems({ initialItems: items }),
      );

      act(() => {
        result.current.toggleItem('item-2');
      });

      expect(result.current.items[1].selected).toBe(true);
      expect(result.current.selectedItems).toHaveLength(1);
    });

    it('deselects a selected item', () => {
      const items = createItems(3, ['item-2']);
      const { result } = renderHook(() =>
        useSelectableItems({ initialItems: items }),
      );

      act(() => {
        result.current.toggleItem('item-2');
      });

      expect(result.current.items[1].selected).toBe(false);
      expect(result.current.selectedItems).toHaveLength(0);
    });

    it('does nothing for non-existent item id', () => {
      const items = createItems(3);
      const { result } = renderHook(() =>
        useSelectableItems({ initialItems: items }),
      );

      act(() => {
        result.current.toggleItem('non-existent');
      });

      expect(result.current.items).toEqual(items);
      expect(result.current.selectedItems).toHaveLength(0);
    });
  });

  describe('maxSelection', () => {
    it('prevents selecting beyond max', () => {
      const items = createItems(5, ['item-1', 'item-2']);

      const { result } = renderHook(() =>
        useSelectableItems({ initialItems: items, maxSelection: 2 }),
      );

      act(() => {
        result.current.toggleItem('item-3');
      });

      // item-3 should remain unselected
      expect(result.current.items[2].selected).toBe(false);
      expect(result.current.selectedItems).toHaveLength(2);
      expect(logger.warn).toHaveBeenCalledWith(
        'Maximum selection of 2 items reached',
      );
    });

    it('sets isMaxReached when at limit', () => {
      const items = createItems(3, ['item-1', 'item-2']);
      const { result } = renderHook(() =>
        useSelectableItems({ initialItems: items, maxSelection: 2 }),
      );

      expect(result.current.isMaxReached).toBe(true);
    });

    it('allows deselecting when max is reached', () => {
      const items = createItems(3, ['item-1', 'item-2']);
      const { result } = renderHook(() =>
        useSelectableItems({ initialItems: items, maxSelection: 2 }),
      );

      act(() => {
        result.current.toggleItem('item-1');
      });

      expect(result.current.selectedItems).toHaveLength(1);
      expect(result.current.isMaxReached).toBe(false);
    });

    it('isMaxReached is false when no maxSelection set', () => {
      const items = createItems(3, ['item-1', 'item-2', 'item-3']);
      const { result } = renderHook(() =>
        useSelectableItems({ initialItems: items }),
      );

      expect(result.current.isMaxReached).toBe(false);
    });
  });

  describe('clearSelection', () => {
    it('deselects all items', () => {
      const items = createItems(3, ['item-1', 'item-2', 'item-3']);
      const { result } = renderHook(() =>
        useSelectableItems({ initialItems: items }),
      );

      expect(result.current.selectedItems).toHaveLength(3);

      act(() => {
        result.current.clearSelection();
      });

      expect(result.current.selectedItems).toHaveLength(0);
      expect(result.current.items.every(i => !i.selected)).toBe(true);
    });
  });

  describe('initialItems sync', () => {
    it('updates internal state when initialItems prop changes', () => {
      const firstItems = createItems(2);
      const { result, rerender } = renderHook(
        (props: { items: TestItem[] }) =>
          useSelectableItems({ initialItems: props.items }),
        { initialProps: { items: firstItems } },
      );

      expect(result.current.items).toHaveLength(2);

      const newItems = createItems(4);
      rerender({ items: newItems });

      expect(result.current.items).toHaveLength(4);
    });

    it('keeps the user selection when a refreshed seed arrives', () => {
      const { result, rerender } = renderHook(
        (props: { items: TestItem[] }) =>
          useSelectableItems({ initialItems: props.items }),
        { initialProps: { items: createItems(3) } },
      );

      act(() => {
        result.current.toggleItem('item-2');
      });
      expect(result.current.selectedItems.map(i => i.id)).toEqual(['item-2']);

      // A background refetch re-seeds the same rows with server-side selection.
      rerender({ items: createItems(3, ['item-3']) });

      // item-3 picks up the new seed; item-2 keeps what the user chose.
      expect(result.current.selectedItems.map(i => i.id)).toEqual([
        'item-2',
        'item-3',
      ]);
    });

    it('lets a refreshed seed through for items the user never touched', () => {
      const { result, rerender } = renderHook(
        (props: { items: TestItem[] }) =>
          useSelectableItems({ initialItems: props.items }),
        { initialProps: { items: createItems(3) } },
      );

      expect(result.current.selectedItems).toHaveLength(0);

      rerender({ items: createItems(3, ['item-1', 'item-3']) });

      expect(result.current.selectedItems.map(i => i.id)).toEqual([
        'item-1',
        'item-3',
      ]);
    });

    it('keeps an explicit deselection over a seed that still selects it', () => {
      const { result, rerender } = renderHook(
        (props: { items: TestItem[] }) =>
          useSelectableItems({ initialItems: props.items }),
        { initialProps: { items: createItems(3, ['item-1']) } },
      );

      act(() => {
        result.current.toggleItem('item-1');
      });
      expect(result.current.selectedItems).toHaveLength(0);

      rerender({ items: createItems(3, ['item-1']) });

      expect(result.current.selectedItems).toHaveLength(0);
    });
  });
});
