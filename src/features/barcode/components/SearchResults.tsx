import React, { useEffect, useState } from 'react';
import { errorService } from '#/services/errorService';
import { alertService } from '#/services/alertService';
import { useTranslation } from '#/i18n';
import { ProductResultCard } from './ProductResultCard';
import { ActionButtons } from './ActionButtons';
import { StyleSheet } from 'react-native-unistyles';
import { useAddScannedItem } from '#features/barcode/hooks/useAddScannedItem';
import { promptPantryDuplicate } from '#domain/pantryItemDuplicate';
import { useAppStore } from '#store/useAppStore';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import type {
  BarcodeSource,
  ScanAmount,
  ScannedItem,
} from '#features/barcode/types';
import { ScrollView, View } from 'react-native';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { DataAttributionNotices } from '#components/molecules/DataAttributionNotices';
import { useCachedUnits } from '#store/useAppStore';
import { useReadingSystem } from '#hooks/settings/useReadingSystem';
import { logValidationErrors } from '#/utils/validation/common';
import { ScanAmountSection } from './ScanAmountSection';
import { ScanNutritionSection } from './ScanNutritionSection';
import {
  packageUnitFields,
  packageUnitOf,
  scanAmountDefaults,
  scanAmountOf,
  scanAmountSchema,
  type ScanAmountFormValues,
} from './scanAmountFormConfig';
import { useStoreModeCart } from '#features/shoppingList/hooks/useStoreModeCart';
import { PurchaseAmountSheet } from '#features/shoppingList/ui/PurchaseAmountSheet';
import { useProductDietaryAlerts } from '#features/barcode/hooks/useProductDietaryAlerts';
import { HouseholdAlertsSection } from './HouseholdAlertsSection';
import { useStorePriceMemory } from '#features/barcode/hooks/useStorePriceMemory';
import { StorePriceSection } from './StorePriceSection';
import { useProductOrigin } from '#features/barcode/hooks/useProductOrigin';
import { ProductOriginSection } from './ProductOriginSection';
import { useProductBrandListings } from '#features/barcode/hooks/useProductBrandListings';
import { BrandListingsSection } from './BrandListingsSection';
import { useBrandLists } from '#features/profile/hooks/useBrandLists';
import { AddToBrandListSheet } from '#features/profile/ui/AddToBrandListSheet';

/** The amount field a refusal names, so it is shown there and not alerted. */
const amountFieldOf = (
  field: string | undefined,
): 'quantityInput' | 'unitId' | 'sizeInput' | 'consumeUnitId' | null => {
  if (!field) return null;
  if (field === 'consumeUnit') return 'consumeUnitId';
  if (field === 'netWeight' || field.endsWith('.size')) return 'sizeInput';
  if (field.endsWith('unitId')) return 'unitId';
  if (field.endsWith('.count') || field.endsWith('.quantity')) {
    return 'quantityInput';
  }
  return null;
};

export interface SearchResultsProps {
  item: ScannedItem;
  format?: string;
  onScanAnother: () => void;
  onEditItem?: () => void;
  onCreateVariant?: () => void;
  editActionLabel?: string;
  source?: BarcodeSource;
  pantryId?: string;
  shoppingListId?: string;
  /** Opens another barcode's result, for a household alternative. */
  onOpenBarcode?: (barcode: string) => void;
  /** Opens the user's brand lists, for a user who has none yet. */
  onOpenBrandLists?: () => void;
  /** Opens every nutrient the scanned product's facts state. */
  onOpenNutrition?: () => void;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  item,
  format,
  onScanAnother,
  onEditItem,
  onCreateVariant,
  editActionLabel,
  source,
  pantryId,
  shoppingListId,
  onOpenBarcode,
  onOpenBrandLists,
  onOpenNutrition,
}) => {
  const { t } = useTranslation();
  const [isAdded, setIsAdded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditingAmount, setIsEditingAmount] = useState(false);
  const [isAskingPrice, setIsAskingPrice] = useState(false);
  const [isAddingToList, setIsAddingToList] = useState(false);
  const setPendingPantryScrollToTop = useAppStore(
    s => s.setPendingPantryScrollToTop,
  );
  const { addToPantry, restockDuplicate, addToShoppingList, heldUnitOf } =
    useAddScannedItem({ pantryId, shoppingListId });
  const cachedUnits = useCachedUnits();
  // Read once: the stack the pantry held as the scan opened.
  const [heldUnit] = useState(() => heldUnitOf(item.id));
  const packageUnit = packageUnitOf(item, heldUnit, cachedUnits);
  // Read once: the form starts from it, and a send compares against it.
  const readingSystem = useReadingSystem();
  const [prefilledAmount] = useState(() =>
    scanAmountDefaults(item, packageUnit, readingSystem),
  );
  const amountForm = useForm<ScanAmountFormValues>({
    resolver: yupResolver(scanAmountSchema),
    defaultValues: prefilledAmount,
  });
  // The device's units hydrate after mount: a unit field still empty takes
  // the package unit once they do.
  useEffect(() => {
    const { getValues, setValue } = amountForm;
    if (!packageUnit || getValues('unitId') || getValues('unitDisplay')) return;
    const fields = packageUnitFields(packageUnit);
    setValue('unitDisplay', fields.unitDisplay);
    setValue('unitType', fields.unitType);
    setValue('unitId', fields.unitId, { shouldValidate: true });
  }, [amountForm, packageUnit]);
  const cart = useStoreModeCart(
    source === 'storeMode' ? shoppingListId : undefined,
    item,
  );
  const household = useProductDietaryAlerts(item.id);
  const origin = useProductOrigin(item.id, item.brandParentName);
  const brandListings = useProductBrandListings(item.id);
  const brandLists = useBrandLists();
  // The scanned barcode's own brand: the one a list matches on a scan.
  const scannedBrand =
    item.brandId && item.brandName
      ? { id: item.brandId, name: item.brandName }
      : null;
  // The unit the price sheet counts in: the matched line's, else the
  // product's own. A line with no unit of its own gets no comparison.
  const sheetUnit = cart.line ? cart.unit : item.trackingUnit;
  const prices = useStorePriceMemory(
    item.id,
    source === 'storeMode' ? shoppingListId : undefined,
    sheetUnit ?? item.trackingUnit,
  );

  const onPantryAdded = () => {
    setIsAdded(true);
    setPendingPantryScrollToTop(true);
    onScanAnother();
  };

  const reportAddFailure = (error: unknown) => {
    errorService.reportError(error, { operation: 'addItemFromSearch' });
    alertService.alert(t('labels.error'), t('errors.addItemFailed'));
  };

  /** Offers to restock the row the pantry already holds, by the amount stated. */
  const offerRestock = (existingPantryItemId: string, amount: ScanAmount) => {
    promptPantryDuplicate({
      onRestock: () => {
        void executeWithLoadingState(
          async () => {
            // A refusal RESOLVES; the hook has already said so, and the button
            // must not flip to "Added" over it.
            if (!(await restockDuplicate(item, existingPantryItemId, amount))) {
              return;
            }
            onPantryAdded();
          },
          setIsLoading,
          () => {
            alertService.alert(
              t('labels.error'),
              t('errors.restockFailedRetry'),
            );
          },
        );
      },
    });
  };

  /** Ticks the line the scan fulfils, else adds the product and ticks it. */
  const addToCart = async (
    paid: { quantity: number; totalPrice: number | null } | null,
  ) => {
    const lineId = cart.line?.id ?? (await addToShoppingList(item)).rowId;
    if (!lineId) {
      alertService.alert(t('labels.error'), t('errors.addItemFailedRetry'));
      return;
    }
    // A refused tick has already told the user and re-read the list.
    if (!(await cart.tick(lineId, paid))) return;
    setIsAdded(true);
    onScanAnother();
  };

  /** A refusal the amount's fields can show goes on its field; any other is alerted. */
  const showPantryRefusal = (reason: string, field?: string) => {
    const onField = amountFieldOf(field);
    if (!onField) {
      alertService.alert(t('labels.error'), reason);
      return;
    }
    setIsEditingAmount(true);
    amountForm.setError(onField, { type: 'server', message: reason });
  };

  const addItem = (amount: ScanAmount | null) => {
    void executeWithLoadingState(
      async () => {
        if (source === 'pantry' && pantryId && amount) {
          const outcome = await addToPantry(item, amount);

          if (outcome.status === 'duplicate') {
            setIsLoading(false);
            offerRestock(outcome.existingPantryItemId, amount);
            return;
          }

          if (outcome.status === 'rejected') {
            showPantryRefusal(outcome.reason, outcome.field);
            return;
          }
          onPantryAdded();
        } else if (source === 'shoppingList' && shoppingListId) {
          if ((await addToShoppingList(item)).outcome === 'reverted') {
            alertService.alert(
              t('labels.error'),
              t('errors.addItemFailedRetry'),
            );
            return;
          }
          setIsAdded(true);
          onScanAnother();
        } else if (source === 'storeMode' && shoppingListId) {
          await addToCart(null);
        } else {
          alertService.alert(
            t('labels.error'),
            t('errors.missingRequiredInfo'),
          );
        }
      },
      setIsLoading,
      reportAddFailure,
    );
  };

  // An invalid amount opens its fields, so the message shows where it applies.
  const submitPantryAdd = amountForm.handleSubmit(
    values => addItem(scanAmountOf(values, prefilledAmount)),
    errors => {
      setIsEditingAmount(true);
      logValidationErrors(errors);
    },
  );

  const handleAddItem = () => {
    if (!source || isAdded) {
      return;
    }
    if (source === 'pantry') {
      void submitPantryAdd();
      return;
    }
    addItem(null);
  };

  const handlePrice = (quantity: number, totalPrice: number | null) => {
    void executeWithLoadingState(
      async () => {
        await addToCart({ quantity, totalPrice });
        setIsAskingPrice(false);
      },
      setIsLoading,
      reportAddFailure,
    );
  };

  // Determine button label based on source and state
  const getButtonLabel = () => {
    if (isAdded) {
      return t('labels.added');
    }
    if (source === 'storeMode') {
      return cart.inCart ? t('barcode.alreadyInCart') : t('barcode.addToCart');
    }

    return source === 'pantry'
      ? t('addItemSheet.addToPantry')
      : t('labels.addToShoppingList');
  };

  // Only a product not yet in the cart can be added with what it cost.
  const canAddWithPrice = source === 'storeMode' && !cart.inCart && !isAdded;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <ProductResultCard
          item={item}
          readingSystem={readingSystem}
          format={format}
          onEditItem={onEditItem}
          onCreateVariant={onCreateVariant}
          editActionLabel={editActionLabel}
        />

        {source === 'pantry' && !!pantryId && (
          <ScanAmountSection
            form={amountForm}
            editing={isEditingAmount}
            onEdit={() => setIsEditingAmount(true)}
            createsStack={heldUnit === null}
          />
        )}

        <ScanNutritionSection
          nutrition={item.nutrition}
          onOpenDetails={onOpenNutrition}
        />

        <ProductOriginSection {...origin} />

        <BrandListingsSection
          listings={brandListings.listings}
          brandName={scannedBrand?.name ?? null}
          onAddToList={() => setIsAddingToList(true)}
        />

        <HouseholdAlertsSection
          {...household}
          onOpenAlternative={
            onOpenBarcode
              ? alternative => {
                  if (alternative.primaryUpc) {
                    onOpenBarcode(alternative.primaryUpc);
                  }
                }
              : undefined
          }
        />

        <StorePriceSection {...prices} />

        <DataAttributionNotices
          attributions={item.dataAttributions ?? []}
          centered
        />
      </ScrollView>

      {/* Pinned below the scroll, so the add stays in view however long the
          result runs. */}
      <View style={styles.footer}>
        <ActionButtons
          /*
           * No source means no destination for the item. Only a deep link
           * (`scan/result`) can land here without one, and a button that
           * silently no-ops is worse than none.
           */
          primaryAction={
            source
              ? {
                  label: getButtonLabel(),
                  onPress: handleAddItem,
                  disabled: isAdded || cart.inCart,
                  loading: isLoading,
                }
              : undefined
          }
          alternateAction={
            canAddWithPrice
              ? {
                  label: t('barcode.addToCartWithPrice'),
                  onPress: () => setIsAskingPrice(true),
                }
              : undefined
          }
          secondaryAction={{
            label: t('labels.scanAnother'),
            onPress: onScanAnother,
          }}
        />
      </View>

      {!!scannedBrand && (
        <AddToBrandListSheet
          visible={isAddingToList}
          brand={scannedBrand}
          lists={brandLists.lists}
          onDismiss={() => setIsAddingToList(false)}
          onPick={async (listId, reason) => {
            const added = await brandLists.addBrand(
              listId,
              scannedBrand,
              reason,
            );
            if (added) brandListings.refresh();
            return added;
          }}
          onMakeList={() => {
            setIsAddingToList(false);
            onOpenBrandLists?.();
          }}
        />
      )}

      {source === 'storeMode' && (
        <PurchaseAmountSheet
          visible={isAskingPrice}
          item={
            cart.line ?? {
              id: item.id,
              itemName: item.name,
              requestedQuantity: 1,
              unitName: item.trackingUnit?.symbol ?? null,
              estimatedPrice: null,
            }
          }
          onClose={() => setIsAskingPrice(false)}
          onConfirm={handlePrice}
          loading={isLoading}
          describePrice={sheetUnit ? prices.compareToUsual : undefined}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  footer: {
    paddingTop: theme.spacing.md,
  },
}));
