import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useSearchUnitsQuery } from '#generated';
import { useStore } from '#store';
import { InlineAutocomplete } from './InlineAutocomplete';

interface Unit {
  id: string;
  name: string;
  symbol: string;
  abbreviation?: string;
}

interface InlineUnitsAutocompleteProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  onUnitSelected?: (unitId: string | null, unitName: string | null) => void;
  testID?: string;
}

/**
 * InlineUnitsAutocomplete - Autocomplete for units that works inside bottom sheets.
 * Shows suggestions in a dropdown below the input instead of opening a nested modal.
 */
export const InlineUnitsAutocomplete: React.FC<
  InlineUnitsAutocompleteProps
> = ({
  label,
  value,
  onChangeText,
  placeholder,
  required,
  error,
  onUnitSelected,
  testID,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // Get cached units from store
  const cachedUnits = useStore(state => state.cachedUnits);

  // Debounce search term for API query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Use SearchUnits query for server-side filtering
  const { data: searchData, loading: searchLoading } = useSearchUnitsQuery({
    variables: { query: debouncedSearchTerm, limit: 6 },
    skip: !debouncedSearchTerm || debouncedSearchTerm.length < 2,
    fetchPolicy: 'cache-first',
  });

  // Show search results when available, otherwise show cached common units
  const units = useMemo(() => {
    if (debouncedSearchTerm && debouncedSearchTerm.length >= 2) {
      return searchData?.searchUnits || [];
    }
    return cachedUnits;
  }, [debouncedSearchTerm, searchData?.searchUnits, cachedUnits]);

  // Filter cached units client-side for short search terms
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

  const handleTextChange = useCallback(
    (text: string) => {
      onChangeText(text);
      setSearchTerm(text);
      // Only clear unit selection when field is emptied
      if (!text) {
        onUnitSelected?.(null, null);
      }
    },
    [onChangeText, onUnitSelected],
  );

  const handleSelectUnit = useCallback(
    (unit: Unit) => {
      onChangeText(unit.symbol);
      onUnitSelected?.(unit.id, unit.name);
      setSearchTerm('');
    },
    [onChangeText, onUnitSelected],
  );

  const renderUnitItem = useCallback((item: Unit) => (
    <View style={styles.unitItem}>
      <View style={styles.unitContent}>
        <Text style={styles.unitSymbol}>{item.symbol}</Text>
        <Text style={styles.unitName}>{item.name}</Text>
        {item.abbreviation && (
          <Text style={styles.unitAbbreviation}>({item.abbreviation})</Text>
        )}
      </View>
    </View>
  ), []);

  const keyExtractor = useCallback((item: Unit) => item.id, []);

  return (
    <InlineAutocomplete<Unit>
      label={label}
      value={value}
      onChangeText={handleTextChange}
      placeholder={placeholder}
      required={required}
      error={error}
      testID={testID}
      items={filteredUnits}
      loading={searchLoading}
      minSearchLength={1}
      maxResults={6}
      renderItem={renderUnitItem}
      keyExtractor={keyExtractor}
      onSelect={handleSelectUnit}
      autoCapitalize="none"
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
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.primary,
    minWidth: 40,
  },
  unitName: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.textPrimary,
    flex: 1,
  },
  unitAbbreviation: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
}));
