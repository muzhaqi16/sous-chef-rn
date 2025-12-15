import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { BottomSheetAutocompleteInput } from './BottomSheetAutocompleteInput';

interface StorageLocation {
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

interface AddNewItem {
  id: '__add_new__';
  name: string;
  isAddNew: true;
}

type LocationItem = StorageLocation | AddNewItem;

interface StorageLocationAutocompleteInputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  storageLocations: StorageLocation[];
  onStorageLocationSelected?: (locationId: string | null, location: StorageLocation | null) => void;
  onAddNewLocation?: (name: string) => void;
}

export const StorageLocationAutocompleteInput: React.FC<StorageLocationAutocompleteInputProps> = ({
  label,
  value,
  onChangeText,
  placeholder = 'Select storage location',
  required,
  error,
  storageLocations = [],
  onStorageLocationSelected,
  onAddNewLocation,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Filter locations based on search term
  const filteredLocations = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) {
      return storageLocations;
    }

    const lowerSearch = searchTerm.toLowerCase();
    return storageLocations.filter(location => {
      const matchesName = location.name.toLowerCase().includes(lowerSearch);
      const matchesType = location.type.toLowerCase().includes(lowerSearch);
      const matchesParent = location.parentLocation?.name.toLowerCase().includes(lowerSearch);
      return matchesName || matchesType || matchesParent;
    });
  }, [searchTerm, storageLocations]);

  // Sort: default first, then alphabetically
  const sortedLocations = useMemo(() => {
    return [...filteredLocations].sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [filteredLocations]);

  // Add "Add New" option when search term doesn't exactly match any existing location
  const dataWithAddNew = useMemo((): LocationItem[] => {
    if (searchTerm.length >= 2) {
      const exactMatch = sortedLocations.some(
        loc => loc.name.toLowerCase() === searchTerm.toLowerCase()
      );
      if (!exactMatch) {
        // Add "Add New" option at the end of the list
        return [
          ...sortedLocations,
          { id: '__add_new__', name: searchTerm, isAddNew: true as const },
        ];
      }
    }
    // If no search or exact match found, just return sorted locations
    // But if there are no locations and user typed something, still show "Add New"
    if (storageLocations.length === 0 && searchTerm.length >= 2) {
      return [{ id: '__add_new__', name: searchTerm, isAddNew: true as const }];
    }
    return sortedLocations;
  }, [sortedLocations, searchTerm, storageLocations.length]);

  // Track if we have a selected location to avoid unnecessary state updates
  const hasSelectionRef = React.useRef(false);

  const handleTextChange = (text: string) => {
    onChangeText(text);
    setSearchTerm(text);
    // Only clear location selection if we had one - avoids extra re-renders
    if (hasSelectionRef.current) {
      hasSelectionRef.current = false;
      onStorageLocationSelected?.(null, null);
    }
  };

  const isAddNewItem = (item: LocationItem): item is AddNewItem => {
    return 'isAddNew' in item && item.isAddNew === true;
  };

  const handleSelectItem = (item: LocationItem) => {
    if (isAddNewItem(item)) {
      // User selected "Add New" option
      hasSelectionRef.current = false;
      onChangeText(item.name);
      setSearchTerm('');
      onStorageLocationSelected?.(null, null);
      onAddNewLocation?.(item.name);
    } else {
      // User selected an existing location
      hasSelectionRef.current = true;
      const displayName = item.parentLocation
        ? `${item.name} (${item.parentLocation.name})`
        : item.name;

      onChangeText(displayName);
      setSearchTerm('');
      onStorageLocationSelected?.(item.id, item);
    }
  };

  const renderLocationItem = (item: LocationItem) => {
    if (isAddNewItem(item)) {
      return (
        <TouchableOpacity
          onPress={() => handleSelectItem(item)}
          style={[styles.locationItem, styles.addNewItem]}
          activeOpacity={0.7}
        >
          <View style={styles.locationContent}>
            <Text style={styles.addNewIcon}>+</Text>
            <View style={styles.locationDetails}>
              <Text style={styles.addNewText}>Add "{item.name}"</Text>
              <Text style={styles.addNewSubtext}>Create new storage location</Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        onPress={() => handleSelectItem(item)}
        style={styles.locationItem}
        activeOpacity={0.7}
      >
        <View style={styles.locationContent}>
          {item.icon && <Text style={styles.locationIcon}>{item.icon}</Text>}
          <View style={styles.locationDetails}>
            <View style={styles.locationNameRow}>
              <Text style={styles.locationName}>{item.name}</Text>
              {item.isDefault && (
                <View style={styles.defaultBadge}>
                  <Text style={styles.defaultBadgeText}>Default</Text>
                </View>
              )}
            </View>
            {item.parentLocation && (
              <Text style={styles.locationSubtext}>
                Inside {item.parentLocation.name}
              </Text>
            )}
            <Text style={styles.locationTypeText}>
              {item.type.replace(/_/g, ' ')}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <BottomSheetAutocompleteInput
      label={label}
      value={value}
      onChangeText={handleTextChange}
      placeholder={placeholder}
      required={required}
      error={error}
      title="Select a storage location"
      searchPlaceholder="Type to search storage locations..."
      data={dataWithAddNew}
      loading={false}
      renderItem={renderLocationItem}
      keyExtractor={(item: LocationItem) => item.id}
      onSelectItem={handleSelectItem}
      emptyText={storageLocations.length === 0 ? "No storage locations yet" : "No matching locations"}
      emptySubtext={searchTerm.length >= 2 ? `Tap "Add" below to create "${searchTerm}"` : 'Type at least 2 characters to search or add new'}
      onSearchChange={setSearchTerm}
    />
  );
};

const styles = StyleSheet.create(theme => ({
  locationItem: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
  },
  addNewItem: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceVariant,
  },
  locationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  locationIcon: {
    fontSize: theme.typography.fontSize.xl,
    width: 32,
    textAlign: 'center',
  },
  addNewIcon: {
    fontSize: theme.typography.fontSize.xl,
    width: 32,
    textAlign: 'center',
    color: theme.colors.primary,
    fontWeight: '600',
  },
  locationDetails: {
    flex: 1,
  },
  locationNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
  },
  locationName: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  addNewText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '600',
    color: theme.colors.primary,
    marginBottom: theme.spacing.xs,
  },
  addNewSubtext: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  defaultBadge: {
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.primaryLight,
  },
  defaultBadgeText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  locationSubtext: {
    fontSize: theme.typography.fontSize.sm,
    fontStyle: 'italic',
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  locationTypeText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    textTransform: 'capitalize',
  },
}));
