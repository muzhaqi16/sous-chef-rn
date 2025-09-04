import React, {useState, useEffect, useRef, useCallback} from 'react';
import {View, Text, TouchableOpacity, FlatList} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetTextInput,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import {StyleSheet} from 'react-native-unistyles';
import {Input} from '#components/base/Input';
import {useSearchBrandsLazyQuery} from '#generated';

type BrandItem = {
  id: string;
  name: string;
};

interface BrandAutocompleteInputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
}

export const BrandAutocompleteInput: React.FC<BrandAutocompleteInputProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  required,
  error,
}) => {
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [searchBrands, {data: brandsData, loading: brandsLoading}] =
    useSearchBrandsLazyQuery();

  useEffect(() => {
    if (searchTerm.length >= 2) {
      searchBrands({
        variables: {search: searchTerm, limit: 20},
      });
    }
  }, [searchTerm, searchBrands]);

  const brands = brandsData?.brands || [];

  const handleTextChange = (text: string) => {
    onChangeText(text);
    setSearchTerm(text);

    if (text.length >= 1 && !showAutocomplete) {
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
  };

  const handleSelectBrand = (brand: string) => {
    onChangeText(brand);
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

  const renderBrand = ({item}: {item: BrandItem}) => (
    <TouchableOpacity
      onPress={() => handleSelectBrand(item.name)}
      style={styles.brandItem}
      activeOpacity={0.7}>
      <Text style={styles.brandName}>{item.name}</Text>
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
          <Text style={styles.autocompleteTitle}>Select a brand</Text>

          <BottomSheetTextInput
            style={styles.bottomSheetInput}
            value={searchTerm}
            onChangeText={handleBottomSheetTextChange}
            placeholder="Type to search brands..."
            autoFocus={true}
            returnKeyType="search"
          />

          <FlatList
            data={brands || []}
            keyExtractor={item => item.id}
            renderItem={renderBrand}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <BottomSheetView style={styles.messageContainer}>
                <Text style={styles.emptyText}>No brands found</Text>
                <Text style={styles.emptySubtext}>
                  Continue typing to add "{searchTerm}" as a custom brand
                </Text>
              </BottomSheetView>
            }
          />
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
  brandItem: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
  },
  brandName: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textPrimary,
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
