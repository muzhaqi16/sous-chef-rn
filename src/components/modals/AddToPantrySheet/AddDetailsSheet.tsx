import React, { useState, useRef } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppPressable } from '#components/atoms/AppPressable';
import PagerView from 'react-native-pager-view';
import { StyleSheet } from 'react-native-unistyles';
import { usePantryItemSubmission } from '#features/pantry/hooks/usePantryItemSubmission';
import {
  StorageState,
  ItemCondition,
  AcquisitionMethod,
  type StorageLocation,
} from '#/graphql/generated/schemaTypes';

import { MainDetailsPage } from './MainDetailsPage';
import { DetailsPage } from './DetailsPage';
import { StoragePage } from './StoragePage';
import { StockSettingsPage } from './StockSettingsPage';
import { Text } from '#components/atoms/Text';

interface AddDetailsSheetProps {
  pantryId: string | undefined;
  prefilledItemName?: string;
  storageLocations?: StorageLocation[];
  /** Return to the search step of the parent sheet (the "Back"/"Cancel" action). */
  onClose: () => void;
  /** Item was created — the parent closes the whole sheet. */
  onSuccess: () => void;
}

// Page Indicator Components
function PageIndicatorItem({
  label,
  isActive,
  onPress,
}: {
  label: string;
  isActive: boolean;
  onPress: () => void;
}) {
  indicatorStyles.useVariants({ active: isActive });
  return (
    <AppPressable onPress={onPress} style={indicatorStyles.item}>
      <View style={indicatorStyles.dot} />
      <Text style={indicatorStyles.label}>{label}</Text>
    </AppPressable>
  );
}

const PageIndicator: React.FC<{
  pages: readonly string[];
  currentPage: number;
  onPagePress: (index: number) => void;
}> = ({ pages, currentPage, onPagePress }) => {
  return (
    <View style={indicatorStyles.container}>
      {pages.map((label, index) => (
        <PageIndicatorItem
          key={label}
          label={label}
          isActive={currentPage === index}
          onPress={() => onPagePress(index)}
        />
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
    backgroundColor: theme.colors.border,
    variants: {
      active: {
        true: { backgroundColor: theme.colors.primary },
      },
    },
  },
  label: {
    fontSize: theme.fonts.size.sm,
    fontWeight: '400',
    color: theme.colors.textSecondary,
    variants: {
      active: {
        true: {
          color: theme.colors.primary,
          fontWeight: '600',
        },
      },
    },
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));

export const AddDetailsSheet: React.FC<AddDetailsSheetProps> = ({
  pantryId,
  prefilledItemName = '',
  storageLocations = [],
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const pages = [
    t('addToPantry.pageMain'),
    t('addToPantry.pageDetails'),
    t('addToPantry.pageStorage'),
    t('addToPantry.pageStock'),
  ];
  const pagerRef = useRef<PagerView>(null);

  // Page state
  const [currentPage, setCurrentPage] = useState(0);

  // Form state - Page 1 (Main). This component is mounted fresh by the parent
  // sheet each time the user enters the details step, so form fields initialize
  // straight from props — no visibility-driven reset needed.
  const [itemName, setItemName] = useState(prefilledItemName);
  const [quantityInput, setQuantityInput] = useState('1');
  const [unit, setUnit] = useState('');
  const [unitId, setUnitId] = useState<string | null>(null);
  const [storageState, setStorageState] = useState<StorageState>(
    StorageState.Ambient,
  );
  const [category, setCategory] = useState('');

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
  const [pantryNetWeightUnitId, setPantryNetWeightUnitId] = useState<
    string | null
  >(null);

  // Form state - Page 2 (Details)
  const [expirationDate, setExpirationDate] = useState<Date | null>(null);

  // Form state - Page 3 (Storage)
  const [storageLocation, setStorageLocation] = useState('');
  const [selectedStorageLocationId, setSelectedStorageLocationId] = useState<
    string | null
  >(null);
  const [storageNotes, setStorageNotes] = useState('');
  const [condition, setCondition] = useState<ItemCondition>(ItemCondition.Good);
  const [tags, setTags] = useState('');
  const [brand, setBrand] = useState('');
  const [, setSelectedBrandId] = useState<string | null>(null);
  // Brand suggestions are not populated in this form; kept as a stable empty
  // list for the MainDetailsPage prop contract.
  const [suggestedBrands] = useState<{ id: string; name: string }[]>([]);

  // Form state - Page 4 (Stock + Purchase)
  const [minQuantity, setMinQuantity] = useState('');
  const [restockQuantity, setRestockQuantity] = useState('');
  const [storeName, setStoreName] = useState('');
  const [storeId, setStoreId] = useState<string | null>(null);
  const [costPerUnit, setCostPerUnit] = useState('');
  const [acquisitionMethod, setAcquisitionMethod] = useState<AcquisitionMethod>(
    AcquisitionMethod.Purchased,
  );

  // Handle store selection (PurchaseInfoInput stores by id; free text isn't sent)
  const handleStoreSelected = (id: string | null, name: string | null) => {
    setStoreId(id);
    if (name) setStoreName(name);
  };

  // Handle unit selection
  const handleUnitSelected = (id: string | null, name: string | null) => {
    setUnitId(id);
    if (name) setUnit(name);
  };

  // Handle content unit selection
  const handleContentUnitSelected = (
    id: string | null,
    name: string | null,
  ) => {
    setContentUnitId(id);
    if (name) setContentUnit(name);
  };

  // Handle pantry net weight unit selection
  const handlePantryNetWeightUnitSelected = (
    id: string | null,
    name: string | null,
  ) => {
    setPantryNetWeightUnitId(id);
    if (name) setPantryNetWeightUnit(name);
  };

  // Handle weight unit selection
  const handleWeightUnitSelected = (id: string | null, name: string | null) => {
    setWeightUnitId(id);
    if (name) setWeightUnit(name);
  };

  // Handle storage location selection
  const handleStorageLocationSelected = (
    locationId: string | null,
    location: StorageLocation | null,
  ) => {
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
  const handleBrandSelected = (brandId: string | null) => {
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
    condition,
    tags,
    brand,
    category,
    minQuantity,
    restockQuantity,
    storeId,
    costPerUnit,
    acquisitionMethod,
    onSuccess,
    handlePageChange,
  });

  return (
    <View style={styles.container} testID="add-pantry-item-details-modal">
      {/* Header */}
      <View style={styles.header}>
        <AppPressable onPress={onClose} style={styles.cancelButton}>
          <Text size="md" weight="medium" tone="secondary">
            {t('addToPantry.cancel')}
          </Text>
        </AppPressable>
        <Text size="lg" weight="bold" align="center" style={styles.title}>
          {t('addToPantry.addItemDetails')}
        </Text>
        <AppPressable
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleConfirm}
          disabled={loading}
          testID="add-pantry-item-submit-button"
        >
          <Text size="md" weight="semibold" style={styles.saveButtonText}>
            {loading ? t('addToPantry.adding') : t('addToPantry.add')}
          </Text>
        </AppPressable>
      </View>

      {/* Page Indicators */}
      <PageIndicator
        pages={pages}
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
          category={category}
          setCategory={setCategory}
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
          condition={condition}
          setCondition={setCondition}
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
          storeName={storeName}
          setStoreName={setStoreName}
          handleStoreSelected={handleStoreSelected}
          costPerUnit={costPerUnit}
          setCostPerUnit={setCostPerUnit}
          acquisitionMethod={acquisitionMethod}
          setAcquisitionMethod={setAcquisitionMethod}
          insets={insets}
        />
      </PagerView>
    </View>
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
  title: {
    flex: 1,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.md,
  },
  saveButtonDisabled: {
    opacity: theme.opacity.disabled,
  },
  saveButtonText: {
    color: theme.colors.white,
  },
  pager: {
    flex: 1,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
