import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import PagerView from 'react-native-pager-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedBottomSheetConfigs, useBottomSheetBackHandler } from '#hooks';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import {
  FormInput,
  EditableCounter,
  InlineUnitsAutocomplete,
  InlineBrandAutocomplete,
  InlineStorageLocationAutocomplete,
  FieldRow,
  DatePickerField,
  SegmentedControl,
} from '#components/molecules';
import type { StorageLocation } from '#components/molecules/InlineStorageLocationAutocomplete';
import { parseFractionalInput } from '#/utils';
import { StorageState, useCreatePantryItemMutation } from '#generated';
import { createAddToParentConnectionUpdater } from '#/apollo/utils';

const STORAGE_STATES = Object.values(StorageState);
const PAGES = ['Main', 'Details', 'Storage', 'Stock'] as const;

interface AddDetailsSheetProps {
  visible: boolean;
  pantryId: string | undefined;
  prefilledItemName?: string;
  storageLocations?: StorageLocation[];
  onClose: () => void;
  onSuccess: () => void;
}

// Page Indicator Component
const PageIndicator: React.FC<{
  pages: readonly string[];
  currentPage: number;
  onPagePress: (index: number) => void;
}> = ({ pages, currentPage, onPagePress }) => {
  const { theme } = useUnistyles();

  return (
    <View style={indicatorStyles.container}>
      {pages.map((label, index) => (
        <TouchableOpacity
          key={label}
          onPress={() => onPagePress(index)}
          style={indicatorStyles.item}
        >
          <View
            style={[
              indicatorStyles.dot,
              {
                backgroundColor:
                  currentPage === index
                    ? theme.colors.primary
                    : theme.colors.border,
              },
            ]}
          />
          <Text
            style={[
              indicatorStyles.label,
              {
                color:
                  currentPage === index
                    ? theme.colors.primary
                    : theme.colors.textSecondary,
                fontWeight: currentPage === index ? '600' : '400',
              },
            ]}
          >
            {label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const indicatorStyles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  item: {
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: theme.radii.full,
  },
  label: {
    fontSize: theme.fonts.size.sm,
  },
}));

export const AddDetailsSheet: React.FC<AddDetailsSheetProps> = ({
  visible,
  pantryId,
  prefilledItemName = '',
  storageLocations = [],
  onClose,
  onSuccess,
}) => {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const pagerRef = useRef<PagerView>(null);
  const animationConfigs = useSharedBottomSheetConfigs();
  useBottomSheetBackHandler(bottomSheetRef, visible);

  // Page state
  const [currentPage, setCurrentPage] = useState(0);

  // Form state - Page 1 (Main)
  const [itemName, setItemName] = useState('');
  const [quantityInput, setQuantityInput] = useState('1');
  const [unit, setUnit] = useState('');
  const [unitId, setUnitId] = useState<string | null>(null);
  const [storageState, setStorageState] = useState<StorageState>(
    StorageState.Ambient,
  );

  // Form state - Page 2 (Details)
  const [expirationDate, setExpirationDate] = useState<Date | null>(null);

  // Form state - Page 3 (Storage)
  const [storageLocation, setStorageLocation] = useState('');
  const [selectedStorageLocationId, setSelectedStorageLocationId] = useState<
    string | null
  >(null);
  const [storageNotes, setStorageNotes] = useState('');
  const [tags, setTags] = useState('');
  const [brand, setBrand] = useState('');
  const [_selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [suggestedBrands, setSuggestedBrands] = useState<
    { id: string; name: string }[]
  >([]);

  // Form state - Page 4 (Stock)
  const [minQuantity, setMinQuantity] = useState('');
  const [restockQuantity, setRestockQuantity] = useState('');

  // Create mutation
  const [createPantryItem, { loading }] = useCreatePantryItemMutation({
    update: (cache, { data }) => {
      if (!data?.createPantryItem || !pantryId) return;

      try {
        const addToPantryCache = createAddToParentConnectionUpdater(
          'Pantry',
          'itemsConnection',
          'PantryItem',
        );
        addToPantryCache(cache, pantryId, data.createPantryItem);
      } catch (error) {
        console.warn('Cache update failed for createPantryItem:', error);
      }
    },
  });

  // Reset form for adding another item
  const resetForm = useCallback(() => {
    setItemName('');
    setQuantityInput('1');
    setUnit('');
    setUnitId(null);
    setStorageState(StorageState.Ambient);
    setExpirationDate(null);
    setStorageLocation('');
    setSelectedStorageLocationId(null);
    setStorageNotes('');
    setTags('');
    setBrand('');
    setSelectedBrandId(null);
    setSuggestedBrands([]);
    setMinQuantity('');
    setRestockQuantity('');
  }, []);

  // Control visibility
  useEffect(() => {
    if (visible && pantryId) {
      bottomSheetRef.current?.present();
      // Reset form
      resetForm();
      setItemName(prefilledItemName);
      setCurrentPage(0);
      pagerRef.current?.setPage(0);
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible, pantryId, prefilledItemName, resetForm]);

  // Handle unit selection
  const handleUnitSelected = useCallback(
    (id: string | null, name: string | null) => {
      setUnitId(id);
      if (name) setUnit(name);
    },
    [],
  );

  // Handle storage location selection
  const handleStorageLocationSelected = useCallback(
    (locationId: string | null, location: StorageLocation | null) => {
      setSelectedStorageLocationId(locationId);
      // Auto-set storage state based on location temperature
      if (location?.temperature) {
        const temp = location.temperature.toLowerCase();
        if (temp === 'frozen') setStorageState(StorageState.Frozen);
        else if (temp === 'refrigerated')
          setStorageState(StorageState.Refrigerated);
        else setStorageState(StorageState.Ambient);
      }
    },
    [],
  );

  // Handle add new storage location
  const handleAddNewLocation = useCallback((name: string) => {
    setStorageLocation(name);
    setSelectedStorageLocationId(null);
  }, []);

  // Handle brand selection
  const handleBrandSelected = useCallback(
    (brandId: string | null, _brandName: string | null) => {
      setSelectedBrandId(brandId);
    },
    [],
  );

  // Handle page change
  const handlePageChange = useCallback((index: number) => {
    setCurrentPage(index);
    pagerRef.current?.setPage(index);
  }, []);

  // Handle confirm
  const handleConfirm = useCallback(async () => {
    if (!pantryId) return;

    if (!itemName.trim()) {
      Alert.alert('Error', 'Please enter an item name');
      handlePageChange(0);
      return;
    }

    const quantity = parseFractionalInput(quantityInput);
    if (quantity === null || isNaN(quantity) || quantity <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      handlePageChange(0);
      return;
    }

    try {
      await createPantryItem({
        variables: {
          input: {
            pantryId,
            itemName: itemName.trim(),
            quantity,
            unitId: unitId || undefined,
            storageState,
            expiresAt: expirationDate
              ? expirationDate.toISOString().split('T')[0]
              : undefined,
            // Use storage location ID if selected, otherwise use name for server to create
            storageLocationId: selectedStorageLocationId || undefined,
            storageLocationName:
              !selectedStorageLocationId && storageLocation.trim()
                ? storageLocation.trim()
                : undefined,
            storageNotes: storageNotes.trim() || undefined,
            tags: tags
              ? tags
                  .split(',')
                  .map(t => t.trim())
                  .filter(Boolean)
              : undefined,
            itemBrand: brand.trim() || undefined,
            minQuantity: minQuantity ? parseFloat(minQuantity) : undefined,
            restockQuantity: restockQuantity
              ? parseFloat(restockQuantity)
              : undefined,
          },
        },
      });

      onSuccess();
    } catch {
      Alert.alert('Error', 'Failed to add item. Please try again.');
    }
  }, [
    pantryId,
    itemName,
    quantityInput,
    unitId,
    storageState,
    expirationDate,
    selectedStorageLocationId,
    storageLocation,
    storageNotes,
    tags,
    brand,
    minQuantity,
    restockQuantity,
    createPantryItem,
    onSuccess,
    handlePageChange,
  ]);

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={['75%', '90%']}
      enablePanDownToClose
      enableDynamicSizing={false}
      topInset={insets.top}
      onDismiss={onClose}
      animationConfigs={animationConfigs}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backgroundStyle={{ backgroundColor: theme.colors.background }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.textSecondary }}
      backdropComponent={props => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          pressBehavior="close"
        />
      )}
      // @ts-expect-error - BottomSheetModal doesn't officially support testID but it works
      testID="add-pantry-item-details-modal"
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Add Item Details</Text>
          <TouchableOpacity
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            onPress={handleConfirm}
            disabled={loading}
            testID="add-pantry-item-submit-button"
          >
            <Text style={styles.saveButtonText}>
              {loading ? 'Adding...' : 'Add'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Page Indicators */}
        <PageIndicator
          pages={PAGES}
          currentPage={currentPage}
          onPagePress={handlePageChange}
        />

        {/* Swipeable Pages */}
        <PagerView
          ref={pagerRef}
          style={styles.pager}
          initialPage={0}
          scrollEnabled={false}
          onPageSelected={e => setCurrentPage(e.nativeEvent.position)}
        >
          {/* Page 1: Main */}
          <BottomSheetScrollView
            key="main"
            style={styles.page}
            contentContainerStyle={[
              styles.pageContent,
              { paddingBottom: insets.bottom + 20 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Item Name */}
            <View style={styles.section}>
              <FormInput
                label="Item Name"
                required
                value={itemName}
                onChangeText={setItemName}
                placeholder="e.g., Milk, Eggs, Bread..."
                useBottomSheetInput
                autoCapitalize="words"
                testID="add-pantry-item-name-input"
              />
            </View>

            {/* Brand */}
            <View style={[styles.section, { zIndex: 10 }]}>
              <InlineBrandAutocomplete
                label="Brand"
                value={brand}
                onChangeText={setBrand}
                placeholder="e.g., Whole Foods, Organic Valley"
                suggestedBrands={suggestedBrands}
                onBrandSelected={handleBrandSelected}
              />
            </View>

            {/* Quantity + Unit */}
            <FieldRow>
              <EditableCounter
                label="Quantity"
                required
                value={quantityInput}
                onChangeText={setQuantityInput}
                placeholder="1"
                testID="add-pantry-item-quantity-input"
              />
              <InlineUnitsAutocomplete
                label="Unit"
                value={unit}
                onChangeText={setUnit}
                onUnitSelected={handleUnitSelected}
                placeholder="pcs, dozen"
                testID="add-pantry-item-unit-picker"
              />
            </FieldRow>

            {/* Storage State */}
            <SegmentedControl
              label="Storage"
              options={STORAGE_STATES}
              value={storageState}
              onChange={setStorageState}
            />
          </BottomSheetScrollView>
          {/* Page 2: Details */}
          <BottomSheetScrollView
            key="details"
            style={styles.page}
            contentContainerStyle={[
              styles.pageContent,
              { paddingBottom: insets.bottom + 20 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Expiration Date */}
            <DatePickerField
              label="Expiration Date"
              value={expirationDate}
              onChange={setExpirationDate}
              placeholder="Select date"
              minimumDate={new Date()}
            />
          </BottomSheetScrollView>

          {/* Page 3: Storage */}
          <BottomSheetScrollView
            key="storage"
            style={styles.page}
            contentContainerStyle={[
              styles.pageContent,
              { overflow: 'visible', paddingBottom: insets.bottom + 20 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Storage Location */}
            <View style={[styles.section, { zIndex: 10 }]}>
              <InlineStorageLocationAutocomplete
                label="Storage Location"
                value={storageLocation}
                onChangeText={setStorageLocation}
                placeholder="e.g., Top shelf, Crisper drawer"
                storageLocations={storageLocations}
                onStorageLocationSelected={handleStorageLocationSelected}
                onAddNewLocation={handleAddNewLocation}
              />
            </View>

            {/* Tags */}
            <View style={styles.section}>
              <FormInput
                label="Tags"
                value={tags}
                onChangeText={setTags}
                placeholder="e.g., organic, gluten-free (comma separated)"
                useBottomSheetInput
              />
            </View>

            {/* Notes */}
            <View style={styles.section}>
              <FormInput
                label="Notes"
                value={storageNotes}
                onChangeText={setStorageNotes}
                placeholder="e.g., Store in cool, dry place"
                multiline
                useBottomSheetInput
              />
            </View>
          </BottomSheetScrollView>

          {/* Page 4: Stock Settings */}
          <BottomSheetScrollView
            key="stock"
            style={styles.page}
            contentContainerStyle={[
              styles.pageContent,
              { paddingBottom: insets.bottom + 20 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.sectionTitle}>Low Stock Settings</Text>
            <Text style={styles.sectionDescription}>
              Get notified when this item is running low.
            </Text>

            <View style={styles.section}>
              <FormInput
                label="Alert When Below"
                value={minQuantity}
                onChangeText={setMinQuantity}
                placeholder="e.g., 2"
                keyboardType="decimal-pad"
                useBottomSheetInput
              />
            </View>

            <View style={styles.section}>
              <FormInput
                label="Restock To"
                value={restockQuantity}
                onChangeText={setRestockQuantity}
                placeholder="e.g., 6"
                keyboardType="decimal-pad"
                useBottomSheetInput
              />
            </View>

            <Text style={styles.helpText}>
              Leave empty to disable low stock alerts for this item.
            </Text>
          </BottomSheetScrollView>
        </PagerView>
      </View>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  cancelButton: {
    minWidth: 60,
  },
  cancelButtonText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.medium,
  },
  title: {
    flex: 1,
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.md,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: theme.colors.white,
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
    minHeight: '100%',
    flexGrow: 1,
  },
  pageContent: {
    padding: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    flexGrow: 1,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  sectionDescription: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
  },
  helpText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
    fontStyle: 'italic',
  },
}));
