import { StorageState } from '#generated';

export type LocationFilter = 'all' | 'fridge' | 'freezer' | 'pantry';

/**
 * Filters pantry items by storage location
 *
 * @param items - Array of items with storageState property
 * @param locationFilter - The location filter to apply ('all', 'fridge', 'freezer', 'pantry')
 * @returns Filtered array of items
 */
export function filterByLocation<T extends { storageState?: string | null }>(
  items: T[],
  locationFilter: LocationFilter,
): T[] {
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
        return true;
    }
  });
}
