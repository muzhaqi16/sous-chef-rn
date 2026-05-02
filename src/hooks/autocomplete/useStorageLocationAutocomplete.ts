import { StorageLocation } from '../../graphql/generated/schemaTypes';

interface UseStorageLocationAutocompleteOptions {
  storageLocations: StorageLocation[];
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
    const lowerSearch = searchTerm.toLowerCase();
    return storageLocations.filter(location => {
      const matchesName = location.name.toLowerCase().includes(lowerSearch);
      const matchesType = location.type.toLowerCase().includes(lowerSearch);
      const matchesParent = location.parentLocation?.name
        .toLowerCase()
        .includes(lowerSearch);
      return matchesName || matchesType || matchesParent;
    });
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
    isLoading: false,
    isOnline: true,
  };
}
