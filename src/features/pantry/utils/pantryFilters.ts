import {
  StorageState,
  SortOrder,
  type PantryItemFilters,
  type PantryItemOrderBy,
} from '#/graphql/generated/schemaTypes';
import {
  PantrySortOption,
  PantrySortDirection,
} from '#store/slices/preferenceTypes';

/** Built-in temperature-based filters */
export type BuiltInLocationFilter = 'all' | 'fridge' | 'freezer' | 'pantry';

/** LocationFilter can be a built-in filter or a custom storage location ID */
export type LocationFilter = BuiltInLocationFilter | string;

/** Check if a filter is a built-in filter */
export function isBuiltInFilter(
  filter: LocationFilter,
): filter is BuiltInLocationFilter {
  return ['all', 'fridge', 'freezer', 'pantry'].includes(filter);
}

/**
 * Converts a LocationFilter to a PantryItemFilters object for server-side filtering.
 *
 * @param filter - The location filter ('all', 'fridge', 'freezer', 'pantry', or a custom location ID)
 * @returns PantryItemFilters for the query, or null for 'all' (no filter)
 */
export function locationFilterToQueryFilter(
  filter: LocationFilter,
): PantryItemFilters | null {
  switch (filter) {
    case 'all':
      return null;
    case 'fridge':
      return { storageState: StorageState.Refrigerated };
    case 'freezer':
      return { storageState: StorageState.Frozen };
    case 'pantry':
      return { storageState: StorageState.Ambient };
    default:
      // Custom storage location ID
      return { storageLocationId: filter };
  }
}

/**
 * Maps a UI sort option + direction to the GraphQL PantryItemOrderBy input.
 *
 * @param option - The sort option from the UI ('name', 'expiry', 'quantity', 'recent')
 * @param direction - The sort direction ('asc' or 'desc')
 * @returns PantryItemOrderBy for the query
 */
export function sortOptionToOrderBy(
  option: PantrySortOption,
  direction: PantrySortDirection,
): PantryItemOrderBy {
  const sortOrder =
    direction === PantrySortDirection.ASC ? SortOrder.Asc : SortOrder.Desc;

  switch (option) {
    case PantrySortOption.NAME:
      return { itemName: sortOrder };
    case PantrySortOption.EXPIRY:
      return { expiresAt: sortOrder };
    case PantrySortOption.QUANTITY:
      return { currentQuantity: sortOrder };
    case PantrySortOption.RECENT:
      return { addedAt: sortOrder };
  }
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
