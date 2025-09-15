import React, {useState, useRef, useCallback, useEffect} from 'react';
import {View, Text, TouchableOpacity, FlatList} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetTextInput,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import {StyleSheet} from 'react-native-unistyles';
import {Input} from '#components/base/Input';
import {useGetUnitsQuery} from '#generated';
import {useStore} from '#store';

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
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Get cached units from store
  const {cachedUnits, setCachedUnits} = useStore();

  // Fetch common units and cache them
  const {data: commonUnitsData, loading} = useGetUnitsQuery({
    skip: cachedUnits.length > 0,
    fetchPolicy: 'cache-first',
  });

  // TODO: After running codegen, add enhanced unit search
  // const [searchUnits, {data: searchUnitsData, loading: searchLoading}] = useSearchUnitsLazyQuery();
  //
  // useEffect(() => {
  //   if (searchTerm.length >= 2) {
  //     searchUnits({
  //       variables: { query: searchTerm }
  //     });
  //   }
  // }, [searchTerm, searchUnits]);

  // Cache units in store when fetched
  useEffect(() => {
    if (commonUnitsData?.units && cachedUnits.length === 0) {
      setCachedUnits(commonUnitsData.units);
    }
  }, [commonUnitsData?.units, cachedUnits.length, setCachedUnits]);

  const units =
    cachedUnits.length > 0 ? cachedUnits : commonUnitsData?.units || [];

  // Filter units based on search term
  const filteredUnits = units.filter(
    unit =>
      unit.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      unit.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleTextChange = (text: string) => {
    onChangeText(text);
    setSearchTerm(text);
    // Clear unit selection when user types manually
    onUnitSelected?.(null);

    if (text.length >= 1 && !showAutocomplete && units.length > 0) {
      setShowAutocomplete(true);
      bottomSheetRef.current?.present();
    } else if (text.length === 0 && showAutocomplete) {
      setShowAutocomplete(false);
      bottomSheetRef.current?.dismiss();
    }
  };

  const handleBottomSheetTextChange = (text: string) => {
    setSearchTerm(text);
    onChangeText(text);
    // Clear unit selection when user types manually in bottom sheet
    onUnitSelected?.(null);
  };

  const handleSelectUnit = (unit: Unit) => {
    onChangeText(unit.symbol);
    onUnitSelected?.(unit.id);
    setShowAutocomplete(false);
    bottomSheetRef.current?.dismiss();
  };

  const handleDismiss = useCallback(() => {
    setShowAutocomplete(false);
  }, []);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        enableTouchThrough={false}
        onPress={() => bottomSheetRef.current?.dismiss()}
      />
    ),
    [],
  );

  const renderUnit = ({item}: {item: Unit}) => (
    <TouchableOpacity
      onPress={() => handleSelectUnit(item)}
      style={styles.unitItem}
      activeOpacity={0.7}>
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
    <View>
      <Input
        label={label}
        value={value}
        onChangeText={handleTextChange}
        placeholder={placeholder}
        required={required}
        error={error}
      />

      <BottomSheetModal
        ref={bottomSheetRef}
        snapPoints={['65%', '75%']}
        onDismiss={handleDismiss}
        backdropComponent={renderBackdrop}
        keyboardBehavior="extend"
        enableDynamicSizing={false}
        keyboardBlurBehavior="none"
        android_keyboardInputMode="adjustResize">
        <View style={styles.autocompleteContainer}>
          <Text style={styles.autocompleteTitle}>Select a unit</Text>

          <BottomSheetTextInput
            style={styles.bottomSheetInput}
            value={searchTerm}
            onChangeText={handleBottomSheetTextChange}
            placeholder="Type to search units..."
            autoFocus={true}
            returnKeyType="search"
          />

          {loading ? (
            <BottomSheetView style={styles.messageContainer}>
              <Text style={styles.loadingText}>Loading units...</Text>
            </BottomSheetView>
          ) : (
            <FlatList
              data={filteredUnits}
              keyExtractor={item => item.id}
              renderItem={renderUnit}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <BottomSheetView style={styles.messageContainer}>
                  <Text style={styles.emptyText}>No units found</Text>
                  <Text style={styles.emptySubtext}>
                    Try a different search term
                  </Text>
                </BottomSheetView>
              }
            />
          )}
        </View>
      </BottomSheetModal>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  autocompleteContainer: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  autocompleteTitle: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  bottomSheetInput: {
    marginBottom: theme.spacing.md,
    borderRadius: theme.radii.md,
    fontSize: theme.typography.fontSize.base,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.inputText,
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
  separator: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
    marginHorizontal: theme.spacing.md,
  },
  messageContainer: {
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textSecondary,
  },
  emptyText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  emptySubtext: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
}));
