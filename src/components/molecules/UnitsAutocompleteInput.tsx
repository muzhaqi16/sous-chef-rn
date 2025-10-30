import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useSearchUnitsQuery } from '#generated';
import { useStore } from '#store';
import { BottomSheetAutocompleteInput } from './BottomSheetAutocompleteInput';

interface Unit {
  id: string;
  name: string;
  symbol: string;
  abbreviation?: string;
}

interface UnitsAutocompleteInputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  onUnitSelected?: (unitId: string | null) => void;
}

export const UnitsAutocompleteInput: React.FC<UnitsAutocompleteInputProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  required,
  error,
  onUnitSelected,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // Get cached units from store
  const cachedUnits = useStore(state => state.cachedUnits);

  // Debounce search term to avoid excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Use SearchUnits query for server-side filtering when user types
  // Only search if we have a search term, otherwise show cached common units
  const { data: searchData, loading: searchLoading } = useSearchUnitsQuery({
    variables: { query: debouncedSearchTerm },
    skip: !debouncedSearchTerm || debouncedSearchTerm.length < 2,
    fetchPolicy: 'cache-first',
  });

  // Show search results when available, otherwise show cached common units
  const units = useMemo(() => {
    if (debouncedSearchTerm && debouncedSearchTerm.length >= 2) {
      return searchData?.searchUnits || [];
    }
    // Default to cached common units when no search term
    return cachedUnits;
  }, [debouncedSearchTerm, searchData?.searchUnits, cachedUnits]);

  // Filter cached units client-side for short search terms (< 2 chars)
  const filteredUnits = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) {
      return units.filter(
        unit =>
          unit.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
          unit.name.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }
    return units;
  }, [units, searchTerm]);

  const loading = searchLoading;

  const handleTextChange = (text: string) => {
    onChangeText(text);
    setSearchTerm(text);
    // Clear unit selection when user types manually
    onUnitSelected?.(null);
  };

  const handleSelectUnit = (unit: Unit) => {
    onChangeText(unit.symbol);
    onUnitSelected?.(unit.id);
  };

  const renderUnitItem = (unit: Unit) => (
    <TouchableOpacity
      onPress={() => handleSelectUnit(unit)}
      style={styles.unitItem}
      activeOpacity={0.7}
    >
      <View style={styles.unitContent}>
        <Text style={styles.unitSymbol}>{unit.symbol}</Text>
        <Text style={styles.unitName}>{unit.name}</Text>
        {unit.abbreviation && (
          <Text style={styles.unitAbbreviation}>({unit.abbreviation})</Text>
        )}
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
      title="Select a unit"
      searchPlaceholder="Type to search units..."
      minSearchLength={1}
      data={filteredUnits}
      loading={loading}
      renderItem={renderUnitItem}
      keyExtractor={(item: Unit) => item.id}
      onSelectItem={handleSelectUnit}
      emptyText="No units found"
      emptySubtext="Try a different search term"
      onSearchChange={setSearchTerm}
    />
  );
};

const styles = StyleSheet.create(theme => ({
  unitItem: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
  },
  unitContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  unitSymbol: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '600',
    color: theme.colors.primary,
    minWidth: 40,
  },
  unitName: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textPrimary,
    flex: 1,
  },
  unitAbbreviation: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
}));
