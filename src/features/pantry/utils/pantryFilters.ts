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

export type BuiltInLocationFilter = 'all' | 'fridge' | 'freezer' | 'pantry';

/** A built-in filter or a custom storage location ID. */
export type LocationFilter = BuiltInLocationFilter | string;

export function isBuiltInFilter(
  filter: LocationFilter,
): filter is BuiltInLocationFilter {
  return ['all', 'fridge', 'freezer', 'pantry'].includes(filter);
}

/** Server-side filter for a LocationFilter; null for 'all' (no filter). */
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
      return { storageLocationId: filter };
  }
}

/** Maps a UI sort option + direction to the GraphQL PantryItemOrderBy input. */
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

/** Client-side mirror of {@link locationFilterToQueryFilter}. */
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
        // Strictly AMBIENT, so this stays the mirror its docblock claims: the
        // badge reads the server's `storageStateCounts.ambient` and server mode
        // queries `{ storageState: AMBIENT }`. Treating an unset state as
        // Pantry made the tab disagree with its own count, and show different
        // rows either side of the client/server-mode threshold.
        return item.storageState === StorageState.Ambient;
      default:
        return item.storageLocation?.id === locationFilter;
    }
  });
}
