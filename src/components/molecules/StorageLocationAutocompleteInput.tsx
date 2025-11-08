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

interface StorageLocationAutocompleteInputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  storageLocations: StorageLocation[];
  onStorageLocationSelected?: (locationId: string | null, location: StorageLocation | null) => void;
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

  const handleTextChange = (text: string) => {
    onChangeText(text);
    setSearchTerm(text);
    // Clear location selection when user types manually - allows custom input
    onStorageLocationSelected?.(null, null);
  };

  const handleSelectLocation = (location: StorageLocation) => {
    // Build display name with parent if exists
    const displayName = location.parentLocation
      ? `${location.name} (${location.parentLocation.name})`
      : location.name;

    onChangeText(displayName);
    setSearchTerm('');

    if (onStorageLocationSelected) {
      onStorageLocationSelected(location.id, location);
    }
  };

  const renderLocationItem = (location: StorageLocation) => (
    <TouchableOpacity
      onPress={() => handleSelectLocation(location)}
      style={styles.locationItem}
      activeOpacity={0.7}
    >
      <View style={styles.locationContent}>
        {location.icon && <Text style={styles.locationIcon}>{location.icon}</Text>}
        <View style={styles.locationDetails}>
          <View style={styles.locationNameRow}>
            <Text style={styles.locationName}>{location.name}</Text>
            {location.isDefault && (
              <View style={styles.defaultBadge}>
                <Text style={styles.defaultBadgeText}>Default</Text>
              </View>
            )}
          </View>
          {location.parentLocation && (
            <Text style={styles.locationSubtext}>
              Inside {location.parentLocation.name}
            </Text>
          )}
          <Text style={styles.locationTypeText}>
            {location.type.replace(/_/g, ' ')}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

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
      data={sortedLocations}
      loading={false}
      renderItem={renderLocationItem}
      keyExtractor={(item: StorageLocation) => item.id}
      onSelectItem={handleSelectLocation}
      emptyText="No storage locations found"
      emptySubtext={searchTerm.length >= 2 ? `Continue typing to use "${searchTerm}" as a custom location` : 'Type at least 2 characters to search'}
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
  locationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  locationIcon: {
    fontSize: 24,
    width: 32,
    textAlign: 'center',
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
