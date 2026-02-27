
export interface StorageLocation {
  id: string;
  name: string;
  type: string;
  icon?: string | null;
  color?: string | null;
  temperature?: string | null;
  isDefault: boolean;
  parentLocation?: {
    id: string;
    name: string;
  } | null;
}

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
      const matchesParent = location.parentLocation?.name.toLowerCase().includes(lowerSearch);
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

  // Determine if "Add New" should be shown
  const showAddNew = (() => {
    if (searchTerm.length < 2) return false;
    const exactMatch = sortedLocations.some(
      loc => loc.name.toLowerCase() === searchTerm.toLowerCase(),
    );
    return !exactMatch;
  })();

  return {
    displayItems: sortedLocations,
    showAddNew,
    isLoading: false,
    isOnline: true,
  };
}
