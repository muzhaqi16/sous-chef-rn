import React, { useState, useRef } from 'react';
import {
  useForm,
  useWatch,
  type Resolver,
  type Path,
  type PathValue,
} from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
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
import { makeIdNameHandler } from '#components/modals/makeIdNameHandler';
import { logValidationErrors } from '#/utils/validation/common';
import {
  addPantryItemSchema,
  addPantryItemDefaults,
  FIELD_PAGE,
  type AddPantryItemFormData,
} from './addPantryItemFormConfig';

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
    t('labels.details'),
    t('labels.storage'),
    t('addToPantry.pageStock'),
  ];
  const pagerRef = useRef<PagerView>(null);

  // Page state
  const [currentPage, setCurrentPage] = useState(0);

  // ALL form state lives in react-hook-form: one source of truth, one schema,
  // and validation that renders on the field instead of in a modal. Mounted
  // fresh by the parent sheet each time the user enters the details step, so
  // the defaults initialize straight from props — no reset needed.
  const {
    control,
    handleSubmit,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<AddPantryItemFormData>({
    resolver: yupResolver(
      addPantryItemSchema,
    ) as Resolver<AddPantryItemFormData>,
    defaultValues: addPantryItemDefaults(prefilledItemName),
    // Re-validates as the user edits, so a message retires on the keystroke
    // that fixes it rather than surviving until the next submit.
    mode: 'onChange',
  });

  // Subscribed, because the pages render from these values.
  const values = useWatch({ control }) as AddPantryItemFormData;
  const {
    itemName,
    quantityInput,
    unit,
    unitId,
    storageState,
    category,
    showPackageDetails,
    packageSize,
    contentUnit,
    contentUnitId,
    itemNetWeight,
    weightUnit,
    weightUnitId,
    pantryNetWeight,
    pantryNetWeightUnit,
    pantryNetWeightUnitId,
    expirationDate,
    storageLocation,
    selectedStorageLocationId,
    storageNotes,
    condition,
    tags,
    brand,
    minQuantity,
    restockQuantity,
    storeName,
    storeId,
    costPerUnit,
    acquisitionMethod,
  } = values;

  /**
   * Write a field the user did not type into directly — an autocomplete id, a
   * segmented-control choice, a date. `shouldValidate` so picking a net-weight
   * unit clears that message immediately.
   */
  const setField = <K extends Path<AddPantryItemFormData>>(
    field: K,
    value: PathValue<AddPantryItemFormData, K>,
  ) => {
    setValue(field, value, { shouldDirty: true, shouldValidate: true });
    // `shouldValidate` re-runs the rule on THIS field only, and the
    // all-or-nothing net-weight rule spans `pantryNetWeight`,
    // `pantryNetWeightUnit` and `pantryNetWeightUnitId` — each direction
    // reporting on a different field, so both halves are re-run.
    if (field === 'pantryNetWeight' || field === 'pantryNetWeightUnitId') {
      void trigger(['pantryNetWeightUnit', 'pantryNetWeight']);
    }
  };

  // Setter-shaped adapters, so the four page components keep their existing
  // `value` + `setValue` prop interfaces rather than each being rewritten.
  const setItemName = (v: string) => setField('itemName', v);
  const setQuantityInput = (v: string) => setField('quantityInput', v);
  const setUnit = (v: string) => setField('unit', v);
  const setUnitId = (v: string | null) => setField('unitId', v);
  const setStorageState = (v: StorageState) => setField('storageState', v);
  const setCategory = (v: string) => setField('category', v);
  const setShowPackageDetails = (v: boolean) =>
    setField('showPackageDetails', v);
  const setPackageSize = (v: string) => setField('packageSize', v);
  const setContentUnit = (v: string) => setField('contentUnit', v);
  const setContentUnitId = (v: string | null) => setField('contentUnitId', v);
  const setItemNetWeight = (v: string) => setField('itemNetWeight', v);
  const setWeightUnit = (v: string) => setField('weightUnit', v);
  const setWeightUnitId = (v: string | null) => setField('weightUnitId', v);
  const setPantryNetWeight = (v: string) => setField('pantryNetWeight', v);
  const setPantryNetWeightUnit = (v: string) =>
    setField('pantryNetWeightUnit', v);
  const setPantryNetWeightUnitId = (v: string | null) =>
    setField('pantryNetWeightUnitId', v);
  const setExpirationDate = (v: Date | null) => setField('expirationDate', v);
  const setStorageLocation = (v: string) => setField('storageLocation', v);
  const setSelectedStorageLocationId = (v: string | null) =>
    setField('selectedStorageLocationId', v);
  const setStorageNotes = (v: string) => setField('storageNotes', v);
  const setCondition = (v: ItemCondition) => setField('condition', v);
  const setTags = (v: string) => setField('tags', v);
  const setBrand = (v: string) => setField('brand', v);
  const setMinQuantity = (v: string) => setField('minQuantity', v);
  const setRestockQuantity = (v: string) => setField('restockQuantity', v);
  const setStoreName = (v: string) => setField('storeName', v);
  const setStoreId = (v: string | null) => setField('storeId', v);
  const setCostPerUnit = (v: string) => setField('costPerUnit', v);
  const setAcquisitionMethod = (v: AcquisitionMethod) =>
    setField('acquisitionMethod', v);

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
  });

  return (
    <View style={styles.container} testID="add-pantry-item-details-modal">
      <SheetFormHeader
        title={t('addToPantry.addItemDetails')}
        cancelLabel={t('labels.cancel')}
        saveLabel={loading ? t('labels.adding') : t('labels.add')}
        onCancel={onClose}
        // `handleSubmit` runs the schema first: an invalid form renders its
        // message on the offending field and jumps to that field's page, so
        // the message is on screen rather than behind a tab the user has to
        // find. Only a valid form reaches `handleConfirm`.
        onSave={() => {
          void handleSubmit(handleConfirm, formErrors => {
            logValidationErrors(formErrors);
            const firstField = Object.keys(formErrors)[0];
            const page = FIELD_PAGE[firstField as keyof AddPantryItemFormData];
            if (page !== undefined) handlePageChange(page);
          })();
        }}
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
          itemNameError={errors.itemName?.message}
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
          quantityError={errors.quantityInput?.message}
          pantryNetWeightError={errors.pantryNetWeight?.message}
          pantryNetWeightUnitError={errors.pantryNetWeightUnit?.message}
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
