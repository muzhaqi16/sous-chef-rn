import { pantryTestIDs } from '#features/pantry/testIDs';
import React, { useEffect, useState, useRef } from 'react';
import { useForm, useWatch, type Path, type PathValue } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { BackHandler, View } from 'react-native';
import { useTranslation } from '#/i18n';
import type { Translate } from '#/i18n/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PagerView from 'react-native-pager-view';
import { StyleSheet } from 'react-native-unistyles';
import { usePantryItemSubmission } from '#features/pantry/hooks/usePantryItemSubmission';
import {
  StorageState,
  type ItemCondition,
} from '#/graphql/generated/schemaTypes';
import type { OfferedAcquisitionMethod } from '#features/pantry/utils/itemEnumLabels';
import type { StorageLocationOption } from '#features/catalog/hooks/useStorageLocationAutocomplete';

import { MainDetailsPage } from './MainDetailsPage';
import { DetailsPage } from './DetailsPage';
import { StoragePage } from './StoragePage';
import { StockSettingsPage } from './StockSettingsPage';
import { BottomSheetHeader } from '#components/molecules/BottomSheetHeader';
import { PageIndicator } from '#components/molecules/PageIndicator/PageIndicator';
import { makeIdNameHandler } from '#components/organisms/makeIdNameHandler';
import { takesContents } from '#domain/stockAmount';
import type { UnitType } from '#/graphql/generated/schemaTypes';
import { reportValidationErrors } from '#/utils/validation/common';
import { alertService } from '#/services/alertService';
import { destructiveConfirm } from '#/services/destructiveConfirm';
import type { ThemedBottomSheetTextInputRef } from '#components/atoms/themedComponents';
import { isOwnKey } from '#utils/isOwnKey';
import {
  addPantryItemSchema,
  addPantryItemDefaults,
  FIELD_PAGE,
} from './addPantryItemFormConfig';
import type { AddPantryItemFormData } from '#features/pantry/types';

interface AddDetailsSheetProps {
  pantryId: string | undefined;
  prefilledItemName?: string;
  storageLocations?: readonly StorageLocationOption[];
  /** Return to the search step of the parent sheet (the "Back"/"Cancel" action). */
  onClose: () => void;
  /** Item was created — the parent closes the whole sheet. */
  onSuccess: () => void;
  /** Holds the parent sheet open against a pan-down while input would be lost. */
  onHoldOpen?: (held: boolean) => void;
}

/** Typed input is never dropped without asking, the way `FormScreen` asks. */
const confirmDiscard = (translate: Translate, discard: () => void) =>
  alertService.alert(
    translate('confirmations.discardChangesTitle'),
    translate('confirmations.discardChanges'),
    destructiveConfirm(translate('labels.discard'), discard),
  );

export const AddDetailsSheet: React.FC<AddDetailsSheetProps> = ({
  pantryId,
  prefilledItemName = '',
  storageLocations = [],
  onClose,
  onSuccess,
  onHoldOpen,
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
  const itemNameRef = useRef<ThemedBottomSheetTextInputRef>(null);

  // Page state
  const [currentPage, setCurrentPage] = useState(0);

  // Mounted fresh each time the user enters the details step, so the defaults
  // come straight from props with no `reset`.
  const {
    control,
    handleSubmit,
    setValue,
    trigger,
    formState: { errors, isDirty },
  } = useForm<AddPantryItemFormData>({
    resolver: yupResolver(addPantryItemSchema),
    defaultValues: addPantryItemDefaults(prefilledItemName),
    // Re-validates as the user edits, so a message retires on the keystroke
    // that fixes it rather than surviving until the next submit.
    mode: 'onChange',
  });

  // Subscribed, because the pages render from these values.
  const values = useWatch({
    control,
    compute: (formValues: AddPantryItemFormData) => formValues,
  });
  const {
    itemName,
    quantityInput,
    unit,
    storageState,
    category,
    unitType,
    sizeInput,
    sizeUnitDisplay,
    expirationDate,
    storageLocation,
    storageNotes,
    condition,
    tags,
    brand,
    minQuantity,
    restockQuantity,
    storeName,
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
    // `shouldValidate` re-runs only THIS field, but what a package holds decides
    // these others too. Only a message already showing is re-checked: a size
    // typed a moment before its unit is not yet a mistake.
    const contentsReported = errors.quantityInput ?? errors.sizeUnitId;
    if (contentsReported && (field === 'sizeInput' || field === 'unitType')) {
      void trigger(['quantityInput', 'sizeUnitId']);
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
  const setSizeInput = (v: string) => setField('sizeInput', v);
  const setSizeUnit = (v: string) => setField('sizeUnitDisplay', v);
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
  const setAcquisitionMethod = (v: OfferedAcquisitionMethod) =>
    setField('acquisitionMethod', v);

  // Store selection (PurchaseInfoInput stores by id; free text isn't sent)
  const handleStoreSelected = makeIdNameHandler(setStoreId, setStoreName);
  const pickUnit = makeIdNameHandler(setUnitId, setUnit);
  const handleUnitSelected = (
    id: string | null,
    name: string | null,
    type?: UnitType | null,
  ) => {
    pickUnit(id, name);
    setField('unitType', type ?? null);
  };
  // Each keystroke clears the pick, and a half-typed unit is not yet a mistake.
  const pickSizeUnit = makeIdNameHandler(
    (v: string | null) =>
      setValue('sizeUnitId', v, {
        shouldDirty: true,
        shouldValidate: v !== null,
      }),
    setSizeUnit,
  );
  const handleSizeUnitSelected = (
    id: string | null,
    name: string | null,
    type?: UnitType | null,
  ) => {
    pickSizeUnit(id, name);
    setField('sizeUnitType', type ?? null);
  };

  const handleStorageLocationSelected = (
    locationId: string | null,
    location: StorageLocationOption | null,
  ) => {
    setSelectedStorageLocationId(locationId);
    // `NONE` is "not applicable", so it leaves the chosen state alone.
    if (location?.temperature && location.temperature !== StorageState.None) {
      setStorageState(location.temperature);
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

  const handleCancel = () => (isDirty ? confirmDiscard(t, onClose) : onClose());

  useEffect(() => {
    onHoldOpen?.(isDirty);
    return () => onHoldOpen?.(false);
  }, [isDirty, onHoldOpen]);

  // Registered after the sheet's own Back handler, so it runs first.
  useEffect(() => {
    if (!isDirty) return;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        confirmDiscard(t, onClose);
        return true;
      },
    );
    return () => subscription.remove();
  }, [isDirty, onClose, t]);

  const { handleConfirm, loading } = usePantryItemSubmission({
    pantryId,
    onSuccess,
  });

  return (
    <View style={styles.container} testID={pantryTestIDs.addDetailsModal}>
      <BottomSheetHeader
        title={t('addToPantry.addItemDetails')}
        cancelLabel={t('labels.cancel')}
        confirmLabel={loading ? t('labels.adding') : t('labels.add')}
        onCancel={handleCancel}
        // `handleSubmit` validates first: an invalid form shows its message on
        // the field and jumps to that field's page. Only a valid form reaches
        // `handleConfirm`.
        onConfirm={() => {
          void handleSubmit(handleConfirm, formErrors => {
            reportValidationErrors(formErrors);
            const [firstField] = Object.keys(formErrors);
            if (firstField === undefined || !isOwnKey(FIELD_PAGE, firstField))
              return;
            const page = FIELD_PAGE[firstField];
            if (page !== undefined) handlePageChange(page);
            // Its fields write through `setValue`, so React Hook Form holds no
            // ref to focus; the one a submit can leave empty is Item Name.
            if (firstField === 'itemName') itemNameRef.current?.focus();
          })();
        }}
        saving={loading}
        cancelTestID={pantryTestIDs.addDetailsCancelButton}
        confirmTestID={pantryTestIDs.addDetailsSubmitButton}
        titleTestID={pantryTestIDs.addDetailsTitle}
      />

      {/* Page Indicators */}
      <PageIndicator
        pages={pages}
        currentPage={currentPage}
        onPagePress={handlePageChange}
        testIDFor={pantryTestIDs.addDetailsPage}
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
          itemNameRef={itemNameRef}
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
          unit={unit}
          setUnit={setUnit}
          handleUnitSelected={handleUnitSelected}
          holdsContents={takesContents(unitType)}
          sizeInput={sizeInput}
          setSizeInput={setSizeInput}
          sizeError={errors.sizeInput?.message}
          sizeUnit={sizeUnitDisplay}
          setSizeUnit={setSizeUnit}
          handleSizeUnitSelected={handleSizeUnitSelected}
          sizeUnitError={errors.sizeUnitId?.message}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pager: {
    flex: 1,
  },
});
