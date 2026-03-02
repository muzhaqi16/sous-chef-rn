'use no memo';
import {
  areItemIdsEqual,
  hasOrderChanged,
  findMovedItem,
  getNeighborIds,
} from '../SortableList.utils';
import type { SortableShoppingListItem } from '../types';

const makeItem = (id: string, sortOrder = '0'): SortableShoppingListItem =>
  ({ id, sortOrder } as SortableShoppingListItem);

describe('SortableList.utils', () => {
  describe('areItemIdsEqual', () => {
    it('returns true for identical arrays', () => {
      const items = [makeItem('a'), makeItem('b'), makeItem('c')];
      expect(areItemIdsEqual(items, items)).toBe(true);
    });

    it('returns false for different lengths', () => {
      const items1 = [makeItem('a'), makeItem('b')];
      const items2 = [makeItem('a')];
      expect(areItemIdsEqual(items1, items2)).toBe(false);
    });

    it('returns false when IDs differ', () => {
      const items1 = [makeItem('a'), makeItem('b')];
      const items2 = [makeItem('a'), makeItem('c')];
      expect(areItemIdsEqual(items1, items2)).toBe(false);
    });

    it('returns true for empty arrays', () => {
      expect(areItemIdsEqual([], [])).toBe(true);
    });
  });

  describe('hasOrderChanged', () => {
    it('returns false when order is the same', () => {
      const items = [makeItem('a'), makeItem('b'), makeItem('c')];
      expect(hasOrderChanged(items, [...items])).toBe(false);
    });

    it('returns true when order differs', () => {
      const original = [makeItem('a'), makeItem('b'), makeItem('c')];
      const reordered = [makeItem('c'), makeItem('a'), makeItem('b')];
      expect(hasOrderChanged(original, reordered)).toBe(true);
    });

    it('returns true when lengths differ', () => {
      const original = [makeItem('a'), makeItem('b')];
      const newItems = [makeItem('a')];
      expect(hasOrderChanged(original, newItems)).toBe(true);
    });
  });

  describe('findMovedItem', () => {
    it('finds the item that moved the farthest', () => {
      const original = [makeItem('a'), makeItem('b'), makeItem('c'), makeItem('d')];
      const reordered = [makeItem('a'), makeItem('c'), makeItem('d'), makeItem('b')];
      const result = findMovedItem(original, reordered);
      expect(result).toEqual({ itemId: 'b', newIndex: 3 });
    });

    it('returns null when no items moved', () => {
      const items = [makeItem('a'), makeItem('b')];
      const result = findMovedItem(items, [...items]);
      expect(result).toBeNull();
    });

    it('handles single item move to beginning', () => {
      const original = [makeItem('a'), makeItem('b'), makeItem('c')];
      const reordered = [makeItem('c'), makeItem('a'), makeItem('b')];
      const result = findMovedItem(original, reordered);
      expect(result).not.toBeNull();
      expect(result!.itemId).toBe('c');
      expect(result!.newIndex).toBe(0);
    });
  });

  describe('getNeighborIds', () => {
    it('returns both neighbors for middle position', () => {
      const items = [makeItem('a', '1'), makeItem('b', '2'), makeItem('c', '3')];
      const result = getNeighborIds(items, 1);
      expect(result.afterId).toBe('a');
      expect(result.afterSortOrder).toBe('1');
      expect(result.beforeId).toBe('c');
      expect(result.beforeSortOrder).toBe('3');
    });

    it('returns null afterId for first position', () => {
      const items = [makeItem('a', '1'), makeItem('b', '2')];
      const result = getNeighborIds(items, 0);
      expect(result.afterId).toBeNull();
      expect(result.beforeId).toBe('b');
    });

    it('returns null beforeId for last position', () => {
      const items = [makeItem('a', '1'), makeItem('b', '2')];
      const result = getNeighborIds(items, 1);
      expect(result.afterId).toBe('a');
      expect(result.beforeId).toBeNull();
    });
  });
});
