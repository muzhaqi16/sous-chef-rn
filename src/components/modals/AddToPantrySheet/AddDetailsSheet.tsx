import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import PagerView from 'react-native-pager-view';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { usePantryItemSubmission } from '#hooks/pantry/usePantryItemSubmission';
import { StorageState, type StorageLocation } from '#generated';

import { MainDetailsPage } from './MainDetailsPage';
import { DetailsPage } from './DetailsPage';
import { StoragePage } from './StoragePage';
import { StockSettingsPage } from './StockSettingsPage';

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
                    : theme.colors.border },
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
                fontWeight: currentPage === index ? '600' : '400' },
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
    marginBottom: theme.spacing.md },
  item: {
    alignItems: 'center',
    gap: theme.spacing.xs },
  dot: {
    width: 8,
    height: 8,
    borderRadius: theme.radii.full },
  label: {
    fontSize: theme.fonts.size.sm },
  pressed: {
    opacity: theme.opacity.pressed } }));

export const AddDetailsSheet: React.FC<AddDetailsSheetProps> = ({
  visible,
  pantryId,
  prefilledItemName = '',
  storageLocations = [],
  onClose,
  onSuccess }) => {
  const { ref, modalProps, insets } = useStandardBottomSheet({
    visible: visible && !!pantryId,
    onDismiss: onClose,
    snapPoints: ['75%', '90%'] });
  const pagerRef = useRef<PagerView>(null);

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

  // Render-time form reset: detect when sheet opens and reset all fields
  const [prevVisible, setPrevVisible] = useState(visible);
  const [prevPantryId, setPrevPantryId] = useState(pantryId);
  const [prevPrefilledItemName, setPrevPrefilledItemName] = useState(prefilledItemName);

  if (visible !== prevVisible || pantryId !== prevPantryId || prefilledItemName !== prevPrefilledItemName) {
    setPrevVisible(visible);
    setPrevPantryId(pantryId);
    setPrevPrefilledItemName(prefilledItemName);

    if (visible && pantryId) {
      // Reset all form state inline
      setItemName(prefilledItemName);
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
      setCurrentPage(0);
    }
  }

  // Reset pager position when sheet opens (imperative ref call needs useEffect)
  useEffect(() => {
    if (visible && pantryId) {
      pagerRef.current?.setPage(0);
    }
  }, [visible, pantryId]);

  // Handle unit selection
  const handleUnitSelected = (id: string | null, name: string | null) => {
      setUnitId(id);
      if (name) setUnit(name);
    };

  // Handle content unit selection
  const handleContentUnitSelected = (id: string | null, name: string | null) => {
      setContentUnitId(id);
      if (name) setContentUnit(name);
    };

  // Handle pantry net weight unit selection
  const handlePantryNetWeightUnitSelected = (id: string | null, name: string | null) => {
      setPantryNetWeightUnitId(id);
      if (name) setPantryNetWeightUnit(name);
    };

  // Handle weight unit selection
  const handleWeightUnitSelected = (id: string | null, name: string | null) => {
      setWeightUnitId(id);
      if (name) setWeightUnit(name);
    };

  // Handle storage location selection
  const handleStorageLocationSelected = (locationId: string | null, location: StorageLocation | null) => {
      setSelectedStorageLocationId(locationId);
      // Auto-set storage state based on location temperature
      if (location?.temperature) {
        const temp = location.temperature.toLowerCase();
        if (temp === 'frozen') setStorageState(StorageState.Frozen);
        else if (temp === 'refrigerated')
          setStorageState(StorageState.Refrigerated);
        else setStorageState(StorageState.Ambient);
      }
    };

  // Handle add new storage location
  const handleAddNewLocation = (name: string) => {
    setStorageLocation(name);
    setSelectedStorageLocationId(null);
  };

  // Handle brand selection
  const handleBrandSelected = (brandId: string | null, _brandName: string | null) => {
      setSelectedBrandId(brandId);
    };

  // Handle page change
  const handlePageChange = (index: number) => {
    setCurrentPage(index);
    pagerRef.current?.setPage(index);
  };

  // Submission hook
  const { handleConfirm, loading } = usePantryItemSubmission({
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
    onSuccess,
    handlePageChange });

  return (
    <BottomSheetModal
      ref={ref}
      {...modalProps}
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
          <MainDetailsPage
            itemName={itemName}
            setItemName={setItemName}
            brand={brand}
            setBrand={setBrand}
            suggestedBrands={suggestedBrands}
            handleBrandSelected={handleBrandSelected}
            expirationDate={expirationDate}
            setExpirationDate={setExpirationDate}
            storageState={storageState}
            setStorageState={setStorageState}
            insets={insets}
          />

          {/* Page 2: Details */}
          <DetailsPage
            quantityInput={quantityInput}
            setQuantityInput={setQuantityInput}
            unit={unit}
            setUnit={setUnit}
            handleUnitSelected={handleUnitSelected}
            pantryNetWeight={pantryNetWeight}
            setPantryNetWeight={setPantryNetWeight}
            pantryNetWeightUnit={pantryNetWeightUnit}
            setPantryNetWeightUnit={setPantryNetWeightUnit}
            handlePantryNetWeightUnitSelected={handlePantryNetWeightUnitSelected}
            showPackageDetails={showPackageDetails}
            setShowPackageDetails={setShowPackageDetails}
            packageSize={packageSize}
            setPackageSize={setPackageSize}
            contentUnit={contentUnit}
            setContentUnit={setContentUnit}
            handleContentUnitSelected={handleContentUnitSelected}
            itemNetWeight={itemNetWeight}
            setItemNetWeight={setItemNetWeight}
            weightUnit={weightUnit}
            setWeightUnit={setWeightUnit}
            handleWeightUnitSelected={handleWeightUnitSelected}
            insets={insets}
          />

          {/* Page 3: Storage */}
          <StoragePage
            storageLocation={storageLocation}
            setStorageLocation={setStorageLocation}
            storageLocations={storageLocations}
            handleStorageLocationSelected={handleStorageLocationSelected}
            handleAddNewLocation={handleAddNewLocation}
            tags={tags}
            setTags={setTags}
            storageNotes={storageNotes}
            setStorageNotes={setStorageNotes}
            insets={insets}
          />

          {/* Page 4: Stock Settings */}
          <StockSettingsPage
            minQuantity={minQuantity}
            setMinQuantity={setMinQuantity}
            restockQuantity={restockQuantity}
            setRestockQuantity={setRestockQuantity}
            insets={insets}
          />
        </PagerView>
      </View>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md },
  cancelButton: {
    minWidth: 60 },
  cancelButtonText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.medium },
  title: {
    flex: 1,
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.textPrimary,
    textAlign: 'center' },
  saveButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.md },
  saveButtonDisabled: {
    opacity: theme.opacity.disabled },
  saveButtonText: {
    color: theme.colors.white,
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold },
  pager: {
    flex: 1 },
  pressed: {
    opacity: theme.opacity.pressed } }));
