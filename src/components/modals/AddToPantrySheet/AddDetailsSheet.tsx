import React, { useState, useRef } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
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
import { SheetFormHeader } from '#components/molecules/SheetFormHeader';
import { makeIdNameHandler } from '../makeIdNameHandler';

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
  index,
  isActive,
  onPress,
}: {
  label: string;
  index: number;
  isActive: boolean;
  onPress: () => void;
}) {
  indicatorStyles.useVariants({ active: isActive });
  return (
    <AppPressable
      onPress={onPress}
      // Indexed, not label-derived: the labels are translated, so a
      // label-based matcher would pass in English and fail everywhere else.
      // Without this the later pages of this sheet were unreachable from a
      // test — the quantity field lives on the Stock page and is inside a
      // PagerView, so it is UNMOUNTED until the page is selected, which Detox
      // reports as "No elements found" rather than a visibility timeout.
      testID={`add-pantry-item-page-${index}`}
      style={indicatorStyles.item}
    >
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
          index={index}
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

  // Form state - Page 4 (Stock + Purchase)
  const [minQuantity, setMinQuantity] = useState('');
  const [restockQuantity, setRestockQuantity] = useState('');
  const [storeName, setStoreName] = useState('');
  const [storeId, setStoreId] = useState<string | null>(null);
  const [costPerUnit, setCostPerUnit] = useState('');
  const [acquisitionMethod, setAcquisitionMethod] = useState<AcquisitionMethod>(
    AcquisitionMethod.Purchased,
  );

  // Store selection (PurchaseInfoInput stores by id; free text isn't sent)
  const handleStoreSelected = makeIdNameHandler(setStoreId, setStoreName);
  const handleUnitSelected = makeIdNameHandler(setUnitId, setUnit);
  const handleContentUnitSelected = makeIdNameHandler(
    setContentUnitId,
    setContentUnit,
  );
  const handlePantryNetWeightUnitSelected = makeIdNameHandler(
    setPantryNetWeightUnitId,
    setPantryNetWeightUnit,
  );
  const handleWeightUnitSelected = makeIdNameHandler(
    setWeightUnitId,
    setWeightUnit,
  );

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
      <SheetFormHeader
        title={t('addToPantry.addItemDetails')}
        cancelLabel={t('addToPantry.cancel')}
        saveLabel={loading ? t('addToPantry.adding') : t('addToPantry.add')}
        onCancel={onClose}
        onSave={handleConfirm}
        saving={loading}
        submitTestID="add-pantry-item-submit-button"
      />

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
  pager: {
    flex: 1,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
