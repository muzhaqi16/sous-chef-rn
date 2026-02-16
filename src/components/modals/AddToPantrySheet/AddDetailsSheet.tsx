import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BottomSheetKeyboardAwareScrollView } from '#components/atoms/BottomSheetKeyboardAwareScrollView';
import { GlobalBottomSheetBackdrop } from '#components/atoms/GlobalBottomSheetBackdrop';
import PagerView from 'react-native-pager-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedBottomSheetConfigs } from '#hooks/useSharedBottomSheetConfigs';
import { useBottomSheetBackHandler } from '#hooks/useBottomSheetBackHandler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { FormInput } from '#components/molecules/FormInput';
import { EditableCounter } from '#components/molecules/EditableCounter';
import { BrandAutocompleteField } from '#components/molecules/AutocompleteField/BrandAutocompleteField';
import { UnitAutocompleteField } from '#components/molecules/AutocompleteField/UnitAutocompleteField';
import { StorageLocationAutocompleteField } from '#components/molecules/AutocompleteField/StorageLocationAutocompleteField';
import { FieldRow } from '#components/molecules/FieldRow';
import { DatePickerField } from '#components/molecules/DatePickerField';
import { SegmentedControl } from '#components/molecules/SegmentedControl';
import type { StorageLocation } from '#hooks/autocomplete/useStorageLocationAutocomplete';
import { parseFractionalInput } from '#/utils/fractionUtils';
import {
  StorageState,
  useCreatePantryItemMutation,
  useRestockPantryItemMutation,
} from '#generated';
import { createAddToParentConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import {
  isPantryItemDuplicateError,
  getPantryItemDuplicateInfo,
} from '#/utils/errors/pantryItemDuplicate';

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
        <Pressable
          key={label}
          onPress={() => onPagePress(index)}
          style={({pressed}) => [indicatorStyles.item, pressed && indicatorStyles.pressed]}
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
        </Pressable>
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
  pressed: {
    opacity: 0.7,
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

  // Form state - Package Details (on Page 2)
  const [showPackageDetails, setShowPackageDetails] = useState(false);
  const [packageSize, setPackageSize] = useState('');
  const [contentUnit, setContentUnit] = useState('');
  const [contentUnitId, setContentUnitId] = useState<string | null>(null);
  const [itemNetWeight, setItemNetWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState('');
  const [weightUnitId, setWeightUnitId] = useState<string | null>(null);

  // Form state - Pantry Net Weight (on Page 2, always visible)
  const [pantryNetWeight, setPantryNetWeight] = useState('');
  const [pantryNetWeightUnit, setPantryNetWeightUnit] = useState('');
  const [pantryNetWeightUnitId, setPantryNetWeightUnitId] = useState<string | null>(null);

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
    errorPolicy: 'all',
    update: (cache, { data }) => {
      const pantryItem = data?.createPantryItem?.pantryItem;
      if (!pantryItem || !pantryId) return;

      try {
        const addToPantryCache = createAddToParentConnectionUpdater(
          'Pantry',
          'itemsConnection',
          'PantryItem',
        );
        addToPantryCache(cache, pantryId, pantryItem);
      } catch (error) {
        console.warn('Cache update failed for createPantryItem:', error);
      }
    },
  });

  // Restock mutation
  const [restockPantryItem] = useRestockPantryItemMutation({
    errorPolicy: 'all',
  });

  // Reset form for adding another item
  const resetForm = useCallback(() => {
    setItemName('');
    setQuantityInput('1');
    setUnit('');
    setUnitId(null);
    setStorageState(StorageState.Ambient);
    setShowPackageDetails(false);
    setPackageSize('');
    setContentUnit('');
    setContentUnitId(null);
    setItemNetWeight('');
    setWeightUnit('');
    setWeightUnitId(null);
    setPantryNetWeight('');
    setPantryNetWeightUnit('');
    setPantryNetWeightUnitId(null);
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

  // Handle content unit selection
  const handleContentUnitSelected = useCallback(
    (id: string | null, name: string | null) => {
      setContentUnitId(id);
      if (name) setContentUnit(name);
    },
    [],
  );

  // Handle pantry net weight unit selection
  const handlePantryNetWeightUnitSelected = useCallback(
    (id: string | null, name: string | null) => {
      setPantryNetWeightUnitId(id);
      if (name) setPantryNetWeightUnit(name);
    },
    [],
  );

  // Handle weight unit selection
  const handleWeightUnitSelected = useCallback(
    (id: string | null, name: string | null) => {
      setWeightUnitId(id);
      if (name) setWeightUnit(name);
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
      handlePageChange(1);
      return;
    }

    try {
      // Build itemUnits array if package details are provided
      let itemUnits;
      let netWeight;
      let displayUnitId;
      let totalPackageNetWeight: number | undefined;
      if (showPackageDetails && packageSize && contentUnit) {
        const pkgSize = parseFloat(packageSize);
        if (!isNaN(pkgSize) && pkgSize > 0) {
          itemUnits = [
            {
              unitId: unitId || undefined,
              unitName: !unitId && unit.trim() ? unit.trim() : undefined,
              packageSize: pkgSize,
              contentUnitId: contentUnitId || undefined,
              contentUnitName: !contentUnitId ? contentUnit.trim() : undefined,
              retailUnit: true,
            },
            {
              unitId: contentUnitId || undefined,
              unitName: !contentUnitId ? contentUnit.trim() : undefined,
              isDefault: true,
            },
          ];
        }
        // Set net weight if provided
        if (itemNetWeight) {
          const nw = parseFloat(itemNetWeight);
          if (!isNaN(nw) && nw > 0) {
            netWeight = nw;
            displayUnitId = weightUnitId || undefined;
            if (netWeight !== undefined) {
              totalPackageNetWeight = pkgSize * netWeight;
            }
          }
        }
      }

      // Compute the effective pantry-level net weight
      const effectivePantryNetWeight = pantryNetWeight
        ? parseFloat(pantryNetWeight) || undefined
        : totalPackageNetWeight;
      const effectiveNetWeightUnitId = pantryNetWeightUnitId
        || (totalPackageNetWeight ? displayUnitId : undefined);

      const mutationInput = {
        pantryId,
        quantity,
        unit: (unitId || unit.trim())
          ? {
              unitId: unitId || undefined,
              unitName: !unitId && unit.trim() ? unit.trim() : undefined,
            }
          : undefined,
        storage: {
          storageState,
          storageLocationId: selectedStorageLocationId || undefined,
          storageLocationName:
            !selectedStorageLocationId && storageLocation.trim()
              ? storageLocation.trim()
              : undefined,
          storageNotes: storageNotes.trim() || undefined,
        },
        expiresAt: expirationDate
          ? expirationDate.toISOString().split('T')[0]
          : undefined,
        tags: tags
          ? tags
              .split(',')
              .map(t => t.trim())
              .filter(Boolean)
          : undefined,
        thresholds: (minQuantity || restockQuantity)
          ? {
              minQuantity: minQuantity ? parseFloat(minQuantity) : undefined,
              restockQuantity: restockQuantity
                ? parseFloat(restockQuantity)
                : undefined,
            }
          : undefined,
        netWeight: (effectivePantryNetWeight || effectiveNetWeightUnitId)
          ? {
              netWeight: effectivePantryNetWeight,
              netWeightUnitId: effectiveNetWeightUnitId,
            }
          : undefined,
        item: {
          name: itemName.trim(),
          brand: brand.trim() || undefined,
          units: itemUnits,
          netWeight: netWeight,
          displayUnitId: displayUnitId,
        },
      };

      const result = await createPantryItem({
        variables: { input: mutationInput },
      });

      // Check for duplicate pantry item error
      if (result.error && isPantryItemDuplicateError(result.error)) {
        const duplicateInfo = getPantryItemDuplicateInfo(result.error);
        if (duplicateInfo) {
          Alert.alert(
            'Item Already in Pantry',
            'This item is already in your pantry. Would you like to restock it or add a separate entry?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Restock',
                onPress: async () => {
                  try {
                    await restockPantryItem({
                      variables: {
                        id: duplicateInfo.existingPantryItemId,
                        input: { quantity },
                      },
                    });
                    onSuccess();
                  } catch {
                    Alert.alert('Error', 'Failed to restock item. Please try again.');
                  }
                },
              },
              {
                text: 'Add Anyway',
                onPress: async () => {
                  try {
                    const retryResult = await createPantryItem({
                      variables: {
                        input: { ...mutationInput, forceAdd: true } as any,
                      },
                    });
                    if (retryResult.data?.createPantryItem?.pantryItem) {
                      onSuccess();
                    } else {
                      Alert.alert('Error', 'Failed to add item. Please try again.');
                    }
                  } catch {
                    Alert.alert('Error', 'Failed to add item. Please try again.');
                  }
                },
              },
            ],
          );
          return;
        }
      }

      if (result.data?.createPantryItem?.pantryItem) {
        onSuccess();
      } else if (result.error) {
        Alert.alert('Error', 'Failed to add item. Please try again.');
      }
    } catch {
      Alert.alert('Error', 'Failed to add item. Please try again.');
    }
  }, [
    pantryId,
    itemName,
    quantityInput,
    unit,
    unitId,
    storageState,
    showPackageDetails,
    packageSize,
    contentUnit,
    contentUnitId,
    itemNetWeight,
    weightUnitId,
    pantryNetWeight,
    pantryNetWeightUnitId,
    expirationDate,
    selectedStorageLocationId,
    storageLocation,
    storageNotes,
    tags,
    brand,
    minQuantity,
    restockQuantity,
    createPantryItem,
    restockPantryItem,
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
        <GlobalBottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          pressBehavior="close"
          onClose={() => bottomSheetRef.current?.dismiss()}
        />
      )}
      // @ts-expect-error - BottomSheetModal doesn't officially support testID but it works
      testID="add-pantry-item-details-modal"
    >
      <View style={styles.container} testID="add-pantry-item-details-modal">
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={onClose}
            style={({pressed}) => [styles.cancelButton, pressed && styles.pressed]}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
          <Text style={styles.title}>Add Item Details</Text>
          <Pressable
            style={({pressed}) => [styles.saveButton, loading && styles.saveButtonDisabled, pressed && styles.pressed]}
            onPress={handleConfirm}
            disabled={loading}
            testID="add-pantry-item-submit-button"
          >
            <Text style={styles.saveButtonText}>
              {loading ? 'Adding...' : 'Add'}
            </Text>
          </Pressable>
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
          <BottomSheetKeyboardAwareScrollView
            key="main"
            style={styles.page}
            contentContainerStyle={[
              styles.pageContent,
              { paddingBottom: insets.bottom + 20 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bottomOffset={16}
          >
            {/* Item Name */}
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

            {/* Brand */}
            <View style={[styles.section, { zIndex: 10 }]}>
              <BrandAutocompleteField
                variant="inline"
                label="Brand"
                value={brand}
                onChangeText={setBrand}
                placeholder="e.g., Whole Foods, Organic Valley"
                suggestedBrands={suggestedBrands}
                onBrandSelected={handleBrandSelected}
              />
            </View>

            {/* Expiration Date */}
            <DatePickerField
              label="Expiration Date"
              value={expirationDate}
              onChange={setExpirationDate}
              placeholder="Select date"
              minimumDate={new Date()}
            />

            {/* Storage State */}
            <SegmentedControl
              label="Storage"
              options={STORAGE_STATES}
              value={storageState}
              onChange={setStorageState}
            />
          </BottomSheetKeyboardAwareScrollView>
          {/* Page 2: Details */}
          <BottomSheetKeyboardAwareScrollView
            key="details"
            style={styles.page}
            contentContainerStyle={[
              styles.pageContent,
              { paddingBottom: insets.bottom + 20 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bottomOffset={16}
          >
            {/* Quantity + Unit */}
            <View style={{ zIndex: 1 }}>
              <FieldRow>
                <EditableCounter
                  label="Quantity"
                  required
                  value={quantityInput}
                  onChangeText={setQuantityInput}
                  placeholder="1"
                  testID="add-pantry-item-quantity-input"
                />
                <UnitAutocompleteField
                  variant="inline"
                  label="Unit"
                  value={unit}
                  onChangeText={setUnit}
                  onUnitSelected={handleUnitSelected}
                  placeholder="pcs, dozen"
                  testID="add-pantry-item-unit-picker"
                />
              </FieldRow>
            </View>

            {/* Net Weight */}
            <View style={{ zIndex: 5 }}>
              <FieldRow>
                <FormInput
                  label="Net Weight"
                  value={pantryNetWeight}
                  onChangeText={setPantryNetWeight}
                  placeholder="e.g., 14.5"
                  keyboardType="decimal-pad"
                  useBottomSheetInput
                  inputStyle={{ height: 44 }}
                />
                <UnitAutocompleteField
                  variant="inline"
                  label="Unit"
                  value={pantryNetWeightUnit}
                  onChangeText={setPantryNetWeightUnit}
                  onUnitSelected={handlePantryNetWeightUnitSelected}
                  placeholder="oz, g, ml"
                />
              </FieldRow>
            </View>

            {/* Package Details - Progressive Disclosure */}
            <View style={styles.section}>
              <Pressable
                onPress={() => setShowPackageDetails(!showPackageDetails)}
                style={({pressed}) => [styles.toggleButton, pressed && styles.pressed]}
              >
                <Text style={styles.toggleButtonText}>
                  {showPackageDetails ? 'Hide Package Details' : 'Add Package Details'}
                </Text>
              </Pressable>

              {showPackageDetails && (
                <View style={styles.packageDetailsContainer}>
                  <Text style={styles.sectionDescription}>
                    Define what's inside a package (e.g., 12 cans of 335ml each).
                  </Text>

                  {/* Package Size */}
                  <FormInput
                    label="Qty per Package"
                    value={packageSize}
                    onChangeText={setPackageSize}
                    placeholder="e.g., 12"
                    keyboardType="decimal-pad"
                    useBottomSheetInput
                  />

                  {/* Content Unit */}
                  <View style={[styles.section, { zIndex: 10 }]}>
                    <UnitAutocompleteField
                      variant="inline"
                      label="Content Unit"
                      value={contentUnit}
                      onChangeText={setContentUnit}
                      onUnitSelected={handleContentUnitSelected}
                      placeholder="e.g., can, bottle"
                    />
                  </View>

                  {/* Net Weight + Weight Unit */}
                  <View style={{ zIndex: 1 }}>
                    <FieldRow>
                      <FormInput
                        label="Weight per Unit"
                        value={itemNetWeight}
                        onChangeText={setItemNetWeight}
                        placeholder="e.g., 335"
                        keyboardType="decimal-pad"
                        useBottomSheetInput
                      />
                      <UnitAutocompleteField
                        variant="inline"
                        label="Weight Unit"
                        value={weightUnit}
                        onChangeText={setWeightUnit}
                        onUnitSelected={handleWeightUnitSelected}
                        placeholder="mL, g, oz"
                      />
                    </FieldRow>
                  </View>
                </View>
              )}
            </View>
          </BottomSheetKeyboardAwareScrollView>

          {/* Page 3: Storage */}
          <BottomSheetKeyboardAwareScrollView
            key="storage"
            style={styles.page}
            contentContainerStyle={[
              styles.pageContent,
              { overflow: 'visible', paddingBottom: insets.bottom + 20 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bottomOffset={16}
          >
            {/* Storage Location */}
            <View style={[styles.section, { zIndex: 10 }]}>
              <StorageLocationAutocompleteField
                variant="inline"
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
            <FormInput
              label="Tags"
              value={tags}
              onChangeText={setTags}
              placeholder="e.g., organic, gluten-free (comma separated)"
              useBottomSheetInput
            />

            {/* Notes */}
            <FormInput
              label="Notes"
              value={storageNotes}
              onChangeText={setStorageNotes}
              placeholder="e.g., Store in cool, dry place"
              multiline
              useBottomSheetInput
            />
          </BottomSheetKeyboardAwareScrollView>

          {/* Page 4: Stock Settings */}
          <BottomSheetKeyboardAwareScrollView
            key="stock"
            style={styles.page}
            contentContainerStyle={[
              styles.pageContent,
              { paddingBottom: insets.bottom + 20 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bottomOffset={16}
          >
            <Text style={styles.sectionTitle}>Low Stock Settings</Text>
            <Text style={styles.sectionDescription}>
              Get notified when this item is running low.
            </Text>

            <FormInput
              label="Alert When Below"
              value={minQuantity}
              onChangeText={setMinQuantity}
              placeholder="e.g., 2"
              keyboardType="decimal-pad"
              useBottomSheetInput
            />

            <FormInput
              label="Restock To"
              value={restockQuantity}
              onChangeText={setRestockQuantity}
              placeholder="e.g., 6"
              keyboardType="decimal-pad"
              useBottomSheetInput
            />

            <Text style={styles.helpText}>
              Leave empty to disable low stock alerts for this item.
            </Text>
          </BottomSheetKeyboardAwareScrollView>
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
    marginBottom: theme.spacing.sm,
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
    marginBottom: theme.spacing.md,
  },
  helpText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
    fontStyle: 'italic',
  },
  toggleButton: {
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
  },
  toggleButtonText: {
    color: theme.colors.primary,
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.medium,
  },
  packageDetailsContainer: {
    marginTop: theme.spacing.sm,
  },
  pressed: {
    opacity: 0.7,
  },
}));
