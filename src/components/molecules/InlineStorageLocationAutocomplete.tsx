import React, { useState, useMemo, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { Label } from '#components/atoms/Label';

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

interface InlineStorageLocationAutocompleteProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  storageLocations: StorageLocation[];
  onStorageLocationSelected?: (locationId: string | null, location: StorageLocation | null) => void;
  onAddNewLocation?: (name: string) => void;
  testID?: string;
}

/**
 * InlineStorageLocationAutocomplete - Storage location picker that works inside bottom sheets.
 * Shows suggestions in a dropdown below the input instead of opening a nested modal.
 */
export const InlineStorageLocationAutocomplete: React.FC<InlineStorageLocationAutocompleteProps> = ({
  label,
  value,
  onChangeText,
  placeholder = 'Select storage location',
  required,
  error,
  storageLocations = [],
  onStorageLocationSelected,
  onAddNewLocation,
  testID,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const hasSelectionRef = useRef(false);

  // Filter locations based on search term
  const filteredLocations = useMemo(() => {
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
        return [
          ...sortedLocations,
          { id: '__add_new__', name: searchTerm, isAddNew: true as const },
        ];
      }
    }
    if (storageLocations.length === 0 && searchTerm.length >= 2) {
      return [{ id: '__add_new__', name: searchTerm, isAddNew: true as const }];
    }
    return sortedLocations;
  }, [sortedLocations, searchTerm, storageLocations.length]);

  // Show suggestions when there are results and user is typing
  const shouldShowSuggestions = useMemo(() => {
    return dataWithAddNew.length > 0 && searchTerm.length >= 1;
  }, [dataWithAddNew.length, searchTerm.length]);

  const handleTextChange = useCallback((text: string) => {
    onChangeText(text);
    setSearchTerm(text);
    setShowSuggestions(true);
    if (hasSelectionRef.current) {
      hasSelectionRef.current = false;
      onStorageLocationSelected?.(null, null);
    }
  }, [onChangeText, onStorageLocationSelected]);

  const isAddNewItem = (item: LocationItem): item is AddNewItem => {
    return 'isAddNew' in item && item.isAddNew === true;
  };

  const handleSelectItem = useCallback((item: LocationItem) => {
    if (isAddNewItem(item)) {
      hasSelectionRef.current = false;
      onChangeText(item.name);
      setSearchTerm('');
      setShowSuggestions(false);
      onStorageLocationSelected?.(null, null);
      onAddNewLocation?.(item.name);
    } else {
      hasSelectionRef.current = true;
      const displayName = item.parentLocation
        ? `${item.name} (${item.parentLocation.name})`
        : item.name;
      onChangeText(displayName);
      setSearchTerm('');
      setShowSuggestions(false);
      onStorageLocationSelected?.(item.id, item);
    }
  }, [onChangeText, onStorageLocationSelected, onAddNewLocation]);

  const handleBlur = useCallback(() => {
    setTimeout(() => setShowSuggestions(false), 200);
  }, []);

  const renderLocationItem = useCallback(({ item }: { item: LocationItem }) => {
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
              <Text style={styles.addNewSubtext}>Create new location</Text>
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
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [handleSelectItem]);

  return (
    <View style={styles.container}>
      {label && <Label required={required}>{label}</Label>}
      <BottomSheetTextInput
        style={[styles.input, error && styles.inputError]}
        value={value}
        onChangeText={handleTextChange}
        placeholder={placeholder}
        onBlur={handleBlur}
        testID={testID}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}

      {showSuggestions && shouldShowSuggestions && (
        <View style={styles.suggestionsContainer}>
          <ScrollView
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={true}
          >
            {dataWithAddNew.slice(0, 6).map((item, index, arr) => (
              <React.Fragment key={item.id}>
                {renderLocationItem({ item })}
                {index < arr.length - 1 && <View style={styles.separator} />}
              </React.Fragment>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    position: 'relative',
    zIndex: 10,
    overflow: 'visible',
  },
  label: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  required: {
    color: theme.colors.error,
  },
  input: {
    height: theme.sizes.input.md,
    borderRadius: theme.radii.md,
    fontSize: theme.fonts.size.md,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.inputText,
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  errorText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.error,
    marginTop: theme.spacing.xs,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: theme.spacing.xs,
    maxHeight: 250,
    overflow: 'hidden',
    zIndex: theme.zIndex.dropdown,
    ...theme.shadows.lg,
  },
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
    width: theme.sizes.button.sm,
    textAlign: 'center',
  },
  addNewIcon: {
    fontSize: theme.typography.fontSize.xl,
    width: theme.sizes.button.sm,
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
  },
  locationName: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  addNewText: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.primary,
  },
  addNewSubtext: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  defaultBadge: {
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.primaryLight,
  },
  defaultBadgeText: {
    fontSize: theme.fonts.size.xs,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.primary,
  },
  locationSubtext: {
    fontSize: theme.fonts.size.sm,
    fontStyle: 'italic',
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
  },
}));

export type { StorageLocation };
