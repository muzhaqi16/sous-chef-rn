import {
  filterByLocation,
  locationFilterToQueryFilter,
  isBuiltInFilter,
  sortOptionToOrderBy,
} from '../pantryFilters';
import { StorageState, SortOrder } from '#/graphql/generated/schemaTypes';
import {
  PantrySortOption,
  PantrySortDirection,
} from '#store/slices/preferenceTypes';

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
    {
      id: '5',
      storageState: StorageState.Refrigerated,
      storageLocation: { id: 'loc-1' },
    },
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

  it('filters by pantry (Ambient only, matching the badge count)', () => {
    const result = filterByLocation(items, 'pantry');
    expect(result.map(i => i.id)).toEqual(['3']);
  });

  it('puts an item with no storage state in no location tab', () => {
    // Item 4 has no state. It is not a location, so it belongs under "All"
    // only — the same treatment fridge and freezer already give it. Counting it
    // as Pantry put 7 rows under a badge that read 2.
    for (const filter of ['fridge', 'freezer', 'pantry'] as const) {
      expect(filterByLocation(items, filter).map(i => i.id)).not.toContain('4');
    }
    expect(filterByLocation(items, 'all').map(i => i.id)).toContain('4');
  });

  it('filters by unassigned (NONE), which has its own tab now', () => {
    const withNone = [
      ...items,
      { id: '6', storageState: StorageState.None, storageLocation: null },
    ];
    expect(filterByLocation(withNone, 'unassigned').map(i => i.id)).toEqual([
      '6',
    ]);
    // And it stays out of ambient — the server's AMBIENT filter excludes it, so
    // folding it in here would put rows under a badge that does not count them.
    expect(filterByLocation(withNone, 'pantry').map(i => i.id)).toEqual(['3']);
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

describe('locationFilterToQueryFilter', () => {
  it('asks the server for exactly what each built-in tab shows', () => {
    expect(locationFilterToQueryFilter('all')).toBeNull();
    expect(locationFilterToQueryFilter('fridge')).toEqual({
      storageState: StorageState.Refrigerated,
    });
    expect(locationFilterToQueryFilter('freezer')).toEqual({
      storageState: StorageState.Frozen,
    });
    expect(locationFilterToQueryFilter('pantry')).toEqual({
      storageState: StorageState.Ambient,
    });
    expect(locationFilterToQueryFilter('unassigned')).toEqual({
      storageState: StorageState.None,
    });
  });

  it('treats anything else as a custom storage location', () => {
    expect(locationFilterToQueryFilter('loc-1')).toEqual({
      storageLocationId: 'loc-1',
    });
  });
});

describe('sortOptionToOrderBy', () => {
  it('maps "name" + "asc" to { itemName: SortOrder.Asc }', () => {
    expect(
      sortOptionToOrderBy(PantrySortOption.NAME, PantrySortDirection.ASC),
    ).toEqual({
      itemName: SortOrder.Asc,
    });
  });

  it('maps "name" + "desc" to { itemName: SortOrder.Desc }', () => {
    expect(
      sortOptionToOrderBy(PantrySortOption.NAME, PantrySortDirection.DESC),
    ).toEqual({
      itemName: SortOrder.Desc,
    });
  });

  it('maps "expiry" + "asc" to { expiresAt: SortOrder.Asc }', () => {
    expect(
      sortOptionToOrderBy(PantrySortOption.EXPIRY, PantrySortDirection.ASC),
    ).toEqual({
      expiresAt: SortOrder.Asc,
    });
  });

  it('maps "expiry" + "desc" to { expiresAt: SortOrder.Desc }', () => {
    expect(
      sortOptionToOrderBy(PantrySortOption.EXPIRY, PantrySortDirection.DESC),
    ).toEqual({
      expiresAt: SortOrder.Desc,
    });
  });

  it('maps "quantity" + "asc" to { currentQuantity: SortOrder.Asc }', () => {
    expect(
      sortOptionToOrderBy(PantrySortOption.QUANTITY, PantrySortDirection.ASC),
    ).toEqual({
      currentQuantity: SortOrder.Asc,
    });
  });

  it('maps "quantity" + "desc" to { currentQuantity: SortOrder.Desc }', () => {
    expect(
      sortOptionToOrderBy(PantrySortOption.QUANTITY, PantrySortDirection.DESC),
    ).toEqual({
      currentQuantity: SortOrder.Desc,
    });
  });

  it('maps "recent" + "asc" to { addedAt: SortOrder.Asc }', () => {
    expect(
      sortOptionToOrderBy(PantrySortOption.RECENT, PantrySortDirection.ASC),
    ).toEqual({
      addedAt: SortOrder.Asc,
    });
  });

  it('maps "recent" + "desc" to { addedAt: SortOrder.Desc }', () => {
    expect(
      sortOptionToOrderBy(PantrySortOption.RECENT, PantrySortDirection.DESC),
    ).toEqual({
      addedAt: SortOrder.Desc,
    });
  });
});
