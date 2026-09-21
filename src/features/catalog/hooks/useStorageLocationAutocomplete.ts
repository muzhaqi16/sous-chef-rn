import type {
  StorageState,
  StorageType,
} from '#/graphql/generated/schemaTypes';
import { filterByTerm } from '#hooks/search/useLocalSearch';

/** What the storage-location picker reads off a location, and hands back on select. */
export interface StorageLocationOption {
  id: string;
  name: string;
  type: StorageType;
  isDefault: boolean;
  temperature?: StorageState | null;
  parentLocation?: { id: string; name: string } | null;
}

interface UseStorageLocationAutocompleteOptions {
  storageLocations: readonly StorageLocationOption[];
  searchTerm: string;
}

export function useStorageLocationAutocomplete({
  storageLocations = [],
  searchTerm,
}: UseStorageLocationAutocompleteOptions) {
  // Filter locations based on search term
  const filteredLocations = (() => {
    if (!searchTerm || searchTerm.length < 1) {
      return storageLocations;
    }
    return filterByTerm(storageLocations, searchTerm, [
      l => l.name,
      l => l.type,
      l => l.parentLocation?.name,
    ]);
  })();

  // Sort: default first, then alphabetically
  const sortedLocations = (() => {
    return [...filteredLocations].sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return a.name.localeCompare(b.name);
    });
  })();

  // Deduplicate by name+parent (case-insensitive), keeping the first occurrence (defaults sort first)
  const displayItems = (() => {
    const seen = new Set<string>();
    return sortedLocations.filter(loc => {
      const key = `${loc.name.toLowerCase()}::${loc.parentLocation?.id ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  })();

  // Determine if "Add New" should be shown — check against ALL locations, not just filtered
  const showAddNew = (() => {
    if (searchTerm.length < 2) return false;
    const exactMatch = storageLocations.some(
      loc => loc.name.toLowerCase() === searchTerm.toLowerCase(),
    );
    return !exactMatch;
  })();

  return {
    displayItems,
    showAddNew,
  };
}
