import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useSearchUnitsQuery } from '#generated';
import { useStore } from '#store';
import { Label } from '#components/atoms';

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
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Get cached units from store
  const cachedUnits = useStore(state => state.cachedUnits);

  // Debounce search term
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

  // Show suggestions when user is typing and we have results
  useEffect(() => {
    setShowSuggestions(filteredUnits.length > 0 && searchTerm.length > 0);
  }, [filteredUnits.length, searchTerm.length]);

  const handleTextChange = (text: string) => {
    onChangeText(text);
    setSearchTerm(text);
    // Only clear unit selection when field is emptied
    if (!text) {
      onUnitSelected?.(null, null);
    }
  };

  const handleSelectUnit = (unit: Unit) => {
    onChangeText(unit.symbol);
    onUnitSelected?.(unit.id, unit.name);
    setShowSuggestions(false);
    setSearchTerm('');
  };

  const handleBlur = () => {
    // Delay hiding to allow tap on suggestion
    setTimeout(() => setShowSuggestions(false), 200);
  };

  const renderUnitItem = ({ item }: { item: Unit }) => (
    <TouchableOpacity
      onPress={() => handleSelectUnit(item)}
      style={styles.unitItem}
      activeOpacity={0.7}
    >
      <View style={styles.unitContent}>
        <Text style={styles.unitSymbol}>{item.symbol}</Text>
        <Text style={styles.unitName}>{item.name}</Text>
        {item.abbreviation && (
          <Text style={styles.unitAbbreviation}>({item.abbreviation})</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {label && <Label required={required}>{label}</Label>}
      <BottomSheetTextInput
        style={[styles.input, error && styles.inputError]}
        value={value}
        onChangeText={handleTextChange}
        placeholder={placeholder}
        onBlur={handleBlur}
        autoCapitalize="none"
        testID={testID}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}

      {showSuggestions && (
        <View style={styles.suggestionsContainer}>
          {searchLoading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Searching...</Text>
            </View>
          ) : (
            <ScrollView
              style={{ flex: 1 }}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={true}
            >
              {filteredUnits.map((item, index) => (
                <React.Fragment key={item.id}>
                  {renderUnitItem({ item })}
                  {index < filteredUnits.length - 1 && (
                    <View style={styles.separator} />
                  )}
                </React.Fragment>
              ))}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    position: 'relative',
    zIndex: 9,
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
    height: 48,
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
    maxHeight: 220,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    zIndex: 100,
  },
  loadingContainer: {
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
  },
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
  separator: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
  },
}));
