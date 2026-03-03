import { filterByLocation, isBuiltInFilter, sortOptionToOrderBy } from '../pantryFilters';
import { StorageState, SortOrder } from '#generated';

describe('isBuiltInFilter', () => {
  it('returns true for "all"', () => {
    expect(isBuiltInFilter('all')).toBe(true);
  });

  it('returns true for "fridge"', () => {
    expect(isBuiltInFilter('fridge')).toBe(true);
  });

  it('returns true for "freezer"', () => {
    expect(isBuiltInFilter('freezer')).toBe(true);
  });

  it('returns true for "pantry"', () => {
    expect(isBuiltInFilter('pantry')).toBe(true);
  });

  it('returns false for custom location ID', () => {
    expect(isBuiltInFilter('custom-location-123')).toBe(false);
  });
});

describe('filterByLocation', () => {
  const items = [
    { id: '1', storageState: StorageState.Refrigerated, storageLocation: null },
    { id: '2', storageState: StorageState.Frozen, storageLocation: null },
    { id: '3', storageState: StorageState.Ambient, storageLocation: null },
    { id: '4', storageState: null, storageLocation: null },
    { id: '5', storageState: StorageState.Refrigerated, storageLocation: { id: 'loc-1' } },
  ];

  it('returns all items for "all" filter', () => {
    expect(filterByLocation(items, 'all')).toEqual(items);
  });

  it('filters by fridge (Refrigerated)', () => {
    const result = filterByLocation(items, 'fridge');
    expect(result.map(i => i.id)).toEqual(['1', '5']);
  });

  it('filters by freezer (Frozen)', () => {
    const result = filterByLocation(items, 'freezer');
    expect(result.map(i => i.id)).toEqual(['2']);
  });

  it('filters by pantry (Ambient or no state)', () => {
    const result = filterByLocation(items, 'pantry');
    expect(result.map(i => i.id)).toEqual(['3', '4']);
  });

  it('filters by custom location ID', () => {
    const result = filterByLocation(items, 'loc-1');
    expect(result.map(i => i.id)).toEqual(['5']);
  });

  it('returns empty array when no items match', () => {
    expect(filterByLocation(items, 'non-existent-loc')).toEqual([]);
  });

  it('handles empty items array', () => {
    expect(filterByLocation([], 'fridge')).toEqual([]);
  });
});

describe('sortOptionToOrderBy', () => {
  it('maps "name" + "asc" to { itemName: SortOrder.Asc }', () => {
    expect(sortOptionToOrderBy('name', 'asc')).toEqual({ itemName: SortOrder.Asc });
  });

  it('maps "name" + "desc" to { itemName: SortOrder.Desc }', () => {
    expect(sortOptionToOrderBy('name', 'desc')).toEqual({ itemName: SortOrder.Desc });
  });

  it('maps "expiry" + "asc" to { expiresAt: SortOrder.Asc }', () => {
    expect(sortOptionToOrderBy('expiry', 'asc')).toEqual({ expiresAt: SortOrder.Asc });
  });

  it('maps "expiry" + "desc" to { expiresAt: SortOrder.Desc }', () => {
    expect(sortOptionToOrderBy('expiry', 'desc')).toEqual({ expiresAt: SortOrder.Desc });
  });

  it('maps "quantity" + "asc" to { currentQuantity: SortOrder.Asc }', () => {
    expect(sortOptionToOrderBy('quantity', 'asc')).toEqual({ currentQuantity: SortOrder.Asc });
  });

  it('maps "quantity" + "desc" to { currentQuantity: SortOrder.Desc }', () => {
    expect(sortOptionToOrderBy('quantity', 'desc')).toEqual({ currentQuantity: SortOrder.Desc });
  });

  it('maps "recent" + "asc" to { addedAt: SortOrder.Asc }', () => {
    expect(sortOptionToOrderBy('recent', 'asc')).toEqual({ addedAt: SortOrder.Asc });
  });

  it('maps "recent" + "desc" to { addedAt: SortOrder.Desc }', () => {
    expect(sortOptionToOrderBy('recent', 'desc')).toEqual({ addedAt: SortOrder.Desc });
  });
});
