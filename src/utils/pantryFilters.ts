import { StorageState } from '#generated';

/** Built-in temperature-based filters */
export type BuiltInLocationFilter = 'all' | 'fridge' | 'freezer' | 'pantry';

/** LocationFilter can be a built-in filter or a custom storage location ID */
export type LocationFilter = BuiltInLocationFilter | string;

/** Check if a filter is a built-in filter */
export function isBuiltInFilter(filter: LocationFilter): filter is BuiltInLocationFilter {
  return ['all', 'fridge', 'freezer', 'pantry'].includes(filter);
}

/**
 * Filters pantry items by storage location
 *
 * @param items - Array of items with storageState and optionally storageLocation
 * @param locationFilter - The location filter to apply:
 *   - 'all': Show all items
 *   - 'fridge': Filter by StorageState.Refrigerated
 *   - 'freezer': Filter by StorageState.Frozen
 *   - 'pantry': Filter by StorageState.Ambient or no state
 *   - Custom location ID: Filter by storageLocation.id
 * @returns Filtered array of items
 */
export function filterByLocation<
  T extends {
    storageState?: string | null;
    storageLocation?: { id: string } | null;
  },
>(items: T[], locationFilter: LocationFilter): T[] {
  if (locationFilter === 'all') return items;

  return items.filter(item => {
    switch (locationFilter) {
      case 'fridge':
        return item.storageState === StorageState.Refrigerated;
      case 'freezer':
        return item.storageState === StorageState.Frozen;
      case 'pantry':
        // Items with Ambient state or no state default to Pantry
        return item.storageState === StorageState.Ambient || !item.storageState;
      default:
        // Custom storage location filter - match by storageLocation.id
        return item.storageLocation?.id === locationFilter;
    }
  });
}
