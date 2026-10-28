import React, { useEffect, useState } from 'react';
import { errorService } from '#/services/errorService';
import { alertService } from '#/services/alertService';
import { useTranslation } from '#/i18n';
import { ProductResultCard } from './ProductResultCard';
import { ActionButtons } from './ActionButtons';
import { StyleSheet } from 'react-native-unistyles';
import { useAddScannedItem } from '#features/barcode/hooks/useAddScannedItem';
import { useAppStore } from '#store/useAppStore';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import type {
  BarcodeSource,
  ScanAmount,
  ScannedItem,
} from '#features/barcode/types';
import { View } from 'react-native';
import { useForm, useWatch } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useCachedUnits } from '#store/useAppStore';
import { formatHeldAmount } from '#features/pantry/hooks/usePantryItemTransformation';
import { useHeldStacks } from '#features/pantry/hooks/useHeldStacks';
import { useReadingSystem } from '#hooks/settings/useReadingSystem';
import { logValidationErrors } from '#/utils/validation/common';
import { ScanAmountSection } from './ScanAmountSection';
import { ScanNutritionSection } from './ScanNutritionSection';
import {
  isMultipack,
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
import { useStoreShelfPrices } from '#features/catalog/hooks/useStoreShelfPrices';
import { StoreShelfPriceSection } from './StoreShelfPriceSection';
import { useBudgetAndPricesEnabled } from '#hooks/settings/useBudgetAndPricesEnabled';
import { useListAsksPrice } from '#features/shoppingList/hooks/useListAsksPrice';
import { useProductOrigin } from '#features/barcode/hooks/useProductOrigin';
import { ProductOriginSection } from './ProductOriginSection';
import { useProductBrandListings } from '#features/barcode/hooks/useProductBrandListings';
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
  const { addToPantry, addToShoppingList } = useAddScannedItem({
    pantryId,
    shoppingListId,
  });
  const cachedUnits = useCachedUnits();
  // Live: the pantry may finish loading, or a member add one, while open.
  const held = useHeldStacks(pantryId, item.id);
  const packageUnit = packageUnitOf(item, held.seedUnit, cachedUnits);
  // Read once: the form starts from it, and a send compares against it.
  const readingSystem = useReadingSystem();
  const [prefilledAmount] = useState(() =>
    scanAmountDefaults(item, packageUnit, readingSystem),
  );
  const amountForm = useForm<ScanAmountFormValues>({
    resolver: yupResolver(scanAmountSchema),
    defaultValues: prefilledAmount,
  });
  // The stack an add in the unit the form now states joins.
  const joinedStack = held.joinedIn(
    useWatch({ control: amountForm.control, name: 'unitId' }),
  );
  // Unread stacks count as none: the API ignores a consume unit on a join.
  const createsStack = held.seedUnit === null;
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
  // Mounted per scan: a second read of the same lists asks nothing.
  const brandLists = useBrandLists({ fetchPolicy: 'cache-first' });
  // The scanned barcode's own brand: the one a list matches on a scan.
  const scannedBrand =
    item.brandId && item.brandName
      ? { id: item.brandId, name: item.brandName }
      : null;
  const brandListings = useProductBrandListings(
    item.id,
    scannedBrand?.id ?? null,
    brandLists.loaded ? brandLists.lists : null,
  );
  // The unit the price sheet counts in: the matched line's, else the
  // product's own. A line with no unit of its own gets no comparison.
  const sheetUnit = cart.line ? cart.unit : item.trackingUnit;
  // Off, store mode shows no money: the price lines read nothing.
  const showPrices = useBudgetAndPricesEnabled();
  const asksPrice = useListAsksPrice(
    source === 'storeMode' ? shoppingListId : null,
  );
  const prices = useStorePriceMemory(
    item.id,
    source === 'storeMode' && showPrices ? shoppingListId : undefined,
    sheetUnit ?? item.trackingUnit,
  );
  const shelfPrices = useStoreShelfPrices(
    item.id,
    source === 'storeMode' ? shoppingListId : null,
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
          // A held product joins its stack, or opens one of its own.
          const outcome = await addToPantry(item, amount);
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
    values =>
      addItem(
        scanAmountOf(values, prefilledAmount, {
          piecesPrefilled: isMultipack(item),
        }),
      ),
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

  // Only a product not yet in the cart can be added with what it cost, and
  // only to a list that asks for prices.
  const canAddWithPrice =
    source === 'storeMode' && asksPrice && !cart.inCart && !isAdded;

  // No source means no destination: only a deep link (`scan/result`) lands here
  // without one, and a button that silently no-ops is worse than none. The
  // header's scan button is the way on either way.
  const addActions = source ? (
    <ActionButtons
      primaryAction={{
        label: getButtonLabel(),
        onPress: handleAddItem,
        disabled: isAdded || cart.inCart,
        loading: isLoading,
      }}
      alternateAction={
        canAddWithPrice
          ? {
              label: t('barcode.addToCartWithPrice'),
              onPress: () => setIsAskingPrice(true),
              // A second add racing the first could leave its tick unpriced.
              disabled: isLoading,
            }
          : undefined
      }
    />
  ) : null;
  const addsToPantry = source === 'pantry' && !!pantryId;

  return (
    <>
      <View style={styles.content}>
        <ProductResultCard
          item={item}
          readingSystem={readingSystem}
          format={format}
          onEditItem={onEditItem}
          onCreateVariant={onCreateVariant}
          editActionLabel={editActionLabel}
          brandLists={
            scannedBrand
              ? {
                  listings: brandListings.listings,
                  onAddToList: () => setIsAddingToList(true),
                }
              : undefined
          }
        />

        {/* The add sits with what it adds: in the pantry's amount card, else
            right under the product. */}
        {addsToPantry ? (
          <ScanAmountSection
            form={amountForm}
            editing={isEditingAmount}
            onEdit={() => setIsEditingAmount(true)}
            createsStack={createsStack}
            joins={
              joinedStack
                ? {
                    amount: formatHeldAmount(joinedStack, readingSystem),
                    unitId: joinedStack.unit.id,
                  }
                : null
            }
            action={addActions}
          />
        ) : (
          addActions
        )}

        <ScanNutritionSection
          nutrition={item.nutrition}
          onOpenDetails={onOpenNutrition}
        />

        <ProductOriginSection {...origin} />

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
        <StoreShelfPriceSection rows={shelfPrices.rows} />
      </View>

      {!!scannedBrand && (
        <AddToBrandListSheet
          visible={isAddingToList}
          brand={scannedBrand}
          lists={brandLists.lists}
          onDismiss={() => setIsAddingToList(false)}
          onPick={(listId, reason) =>
            brandLists.addBrand(listId, scannedBrand, reason)
          }
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
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  // The screen scrolls it and pads its end past the home indicator.
  content: {
    paddingTop: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
}));
