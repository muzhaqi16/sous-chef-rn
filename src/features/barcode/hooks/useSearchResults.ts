import { useEffect, useRef } from 'react';
import { useMutation, useQuery } from '@apollo/client/react';
import { logger } from '#/utils/environment';

import {
  ItemByUpcFilterDocument,
  ItemBySkuFilterDocument,
  CreateItemDocument,
  type CreateItemMutation,
} from '#operations/item/item.generated';
import { UpcFormat } from '#/graphql/generated/schemaTypes';
import {
  useSearchState,
  useBottomSheetState,
} from '#features/barcode/store/barcodeScannerStore';
import type { ScannedItem } from '#features/barcode/store/barcodeScannerStore';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { useTranslation } from '#/i18n';
import { useImageUpload } from '#hooks/useImageUpload';
import {
  mapFormToCreateItemInput,
  stashPendingFormImages,
  uploadPendingImages as sharedUploadPendingImages,
  cleanupPendingImageStorage as sharedCleanupPendingImageStorage,
  type AddItemFormData,
} from '#/utils/items/createItemMapping';
import { errorService } from '#/services/errorService';
import { isNetworkError } from '#/utils/isNetworkError';
import { firstNonBlank } from '#/utils/firstNonBlank';

// Map Vision Camera barcode format to GraphQL UpcFormat enum.
// Source: react-native-vision-camera-barcode-scanner's BarcodeFormat
// ('ean-13' | 'ean-8' | 'upc-a' | 'upc-e' | 'qr-code' | …). BarcodeScannerScreen
// normalizes 'qr-code' → 'qr' before forwarding, so non-UPC formats fall through
// to the default branch and let the API auto-detect.
const mapVisionCameraFormatToUpcFormat = (
  format?: string,
): UpcFormat | undefined => {
  switch (format) {
    case 'ean-13':
      return UpcFormat.Ean_13;
    case 'ean-8':
      return UpcFormat.Ean_8;
    case 'upc-a':
      return UpcFormat.UpcA;
    case 'upc-e':
      return UpcFormat.UpcE;
    case undefined:
    default:
      return undefined; // Let API auto-detect
  }
};

// Helper function to convert GraphQL Item to ScannedItem
const convertToScannedItem = (
  item: {
    id: string;
    name: string;
    description?: string | null;
    imageUrl?: string | null;
    canEdit?: boolean | null;
    canSuggest?: boolean | null;
    primaryUpc?: string | null;
    netWeight?: number | null;
    type?: string | null;
    storageState?: string | null;
    shelfLifeDays?: number | null;
    shelfLifeOpenedDays?: number | null;
    tags?: string[] | null;
    displayUnit?: {
      id: string;
      name: string;
      symbol: string;
    } | null;
    brands?: Array<{
      brand: {
        id: string;
        name: string;
      };
    }> | null;
    categories?: Array<{
      isPrimary?: boolean | null;
      category: {
        id: string;
        name: string;
      };
    }> | null;
    units: Array<{
      unitId: string;
      isDefault?: boolean | null;
    }>;
    variationBrand?: {
      id: string;
      name: string;
    } | null;
    matchedVariation?: {
      netWeight?: number | null;
      netWeightUnit?: string | null;
      packageSize?: string | null;
      confidence?: number | null;
      brandInfo?: {
        id?: string | null;
        name: string;
      } | null;
    } | null;
  },
  fallbackBarcode: string,
  brandNameOverride?: string,
): ScannedItem => {
  // Prefer matched variation data over item defaults
  const effectiveNetWeight =
    item.matchedVariation?.netWeight ?? item.netWeight ?? undefined;

  // Build display unit: prefer variation's netWeightUnit, then fall back to item's displayUnit
  const effectiveDisplayUnit = item.matchedVariation?.netWeightUnit
    ? {
        id: item.displayUnit?.id ?? '',
        name: item.matchedVariation.netWeightUnit,
        symbol: item.matchedVariation.netWeightUnit,
      }
    : item.displayUnit
    ? {
        id: item.displayUnit.id,
        name: item.displayUnit.name,
        symbol: item.displayUnit.symbol,
      }
    : undefined;

  // Brand priority: override > matchedVariation.brandInfo > brands[0] > variationBrand
  const effectiveBrandName =
    brandNameOverride ??
    item.matchedVariation?.brandInfo?.name ??
    item.brands?.[0]?.brand.name ??
    item.variationBrand?.name ??
    undefined;

  const effectiveBrandId =
    item.matchedVariation?.brandInfo?.id ??
    item.brands?.[0]?.brand.id ??
    item.variationBrand?.id ??
    undefined;

  return {
    id: item.id,
    name: item.name,
    description: firstNonBlank(item.description),
    imageUrl: firstNonBlank(item.imageUrl),
    canEdit: item.canEdit ?? undefined,
    canSuggest: item.canSuggest ?? undefined,
    upc: firstNonBlank(item.primaryUpc) ?? fallbackBarcode,
    unitId: item.units.find(u => u.isDefault)?.unitId,
    netWeight: effectiveNetWeight,
    displayUnit: effectiveDisplayUnit,
    brandName: effectiveBrandName,
    brandId: effectiveBrandId,
    type: item.type ?? undefined,
    storageState: item.storageState ?? undefined,
    shelfLifeDays: item.shelfLifeDays ?? undefined,
    shelfLifeOpenedDays: item.shelfLifeOpenedDays ?? undefined,
    tags: item.tags ?? undefined,
    categories: item.categories?.map(c => ({
      id: c.category.id,
      name: c.category.name,
      isPrimary: c.isPrimary ?? undefined,
    })),
  };
};

const uploadPendingImages = sharedUploadPendingImages;
const cleanupPendingImageStorage = sharedCleanupPendingImageStorage;

export const useSearchResults = (barcode: string, format?: string) => {
  const { t } = useTranslation();
  const upcFormat = mapVisionCameraFormatToUpcFormat(format);
  const {
    searchResults,
    setSearching,
    addToRecentlyScanned,
    clearSearch,
    setSearchError,
    setSearchResults,
  } = useSearchState();
  const { showBottomSheet, hideBottomSheet } = useBottomSheetState();

  const { uploadItemImages } = useImageUpload();

  // Ref to store brand name from form for use in mutation callback
  const pendingBrandNameRef = useRef<string | undefined>(undefined);

  // Clear previous search results when barcode changes to prevent showing stale data
  useEffect(() => {
    setSearchResults([]);
    setSearchError(null);
    setSearching(true);
  }, [barcode, setSearchResults, setSearchError, setSearching]);

  const [addNewItem, { loading: addingItem }] = useMutation(
    CreateItemDocument,
    {
      onCompleted: async (data: CreateItemMutation) => {
        const payload = appliedPayload(data);
        if (payload) {
          const createdItem = payload.item;

          // Upload pending images (module-level function avoids try-catch in hook)
          let result;
          try {
            result = await uploadPendingImages(createdItem, uploadItemImages);
          } catch (error) {
            errorService.reportError(error, {
              operation: 'Error handling pending image upload:',
            });
          }
          const finalItem = result ?? createdItem;
          cleanupPendingImageStorage();

          const newItem = convertToScannedItem(
            finalItem,
            barcode,
            pendingBrandNameRef.current,
          );
          pendingBrandNameRef.current = undefined;
          setSearchResults([newItem]);
          addToRecentlyScanned(newItem);
          hideBottomSheet();
        }
      },
    },
  );

  const {
    data: upcData,
    loading: upcLoading,
    error: upcError,
    refetch: refetchUpc,
  } = useQuery(ItemByUpcFilterDocument, {
    variables: { upc: barcode, upcFormat },
    fetchPolicy: 'network-only', // Always fetch fresh - prevents stale data from previous scans
  });

  // Get first item from UPC filter results
  const upcItem = upcData?.items.edges[0]?.node;

  const {
    data: skuData,
    loading: skuLoading,
    error: skuError,
    refetch: refetchSku,
  } = useQuery(ItemBySkuFilterDocument, {
    variables: { sku: barcode, skuStoreId: undefined },
    // Skip SKU search while UPC is loading OR if UPC found a result
    // Must include upcLoading to prevent using stale upcItem from previous scan
    skip: upcLoading || !!upcItem,
    fetchPolicy: 'network-only', // Always fetch fresh - prevents stale data from previous scans
  });

  // Handle UPC query completion - trust API's UPC matching
  useEffect(() => {
    // Only process after loading completes to avoid acting on stale data
    // Apollo's data field retains previous values during loading
    if (!upcLoading && upcItem) {
      // API handles UPC matching (primaryUpc, alternateUpcs, externalSource data, etc.)
      // Just show the result if API returns a match
      setSearching(false);
      const item = convertToScannedItem(upcItem, barcode);
      setSearchResults([item]);
      addToRecentlyScanned(item);
      hideBottomSheet();
    }
  }, [
    upcItem,
    upcLoading,
    barcode,
    setSearching,
    setSearchResults,
    addToRecentlyScanned,
    hideBottomSheet,
  ]);

  // Handle SKU query completion - trust API's SKU matching
  useEffect(() => {
    // Skip if UPC already found a result (handles race condition where SKU query
    // was started before skip took effect and completes after UPC)
    if (upcItem) {
      return;
    }

    const skuItem = skuData?.items.edges[0]?.node;

    // Only process after loading completes to avoid acting on stale data
    // Apollo's data field retains previous values during loading
    if (!skuLoading && skuData) {
      logger.debug('SKU search completed:', {
        barcode,
        foundItem: !!skuItem,
        itemData: skuItem,
      });

      setSearching(false);

      if (skuItem) {
        // API handles SKU matching - just show the result
        const item = convertToScannedItem(skuItem, barcode);
        setSearchResults([item]);
        addToRecentlyScanned(item);
        hideBottomSheet();
        return;
      }

      // Neither UPC nor SKU found a matching item
      setSearchResults([]);
      showBottomSheet(1);
    }
  }, [
    skuData,
    skuLoading,
    barcode,
    upcItem,
    setSearching,
    setSearchResults,
    addToRecentlyScanned,
    hideBottomSheet,
    showBottomSheet,
  ]);

  // `isNetworkError` covers the request timeout too. The server's own message is
  // unlocalized English, so the copy is always the app's.
  useEffect(() => {
    const error = upcError ?? skuError;
    if (!error) return;

    setSearching(false);
    setSearchError(
      isNetworkError(error)
        ? t('errors.networkError')
        : t('errors.codes.genericRetry'),
    );

    if (!upcData?.items.edges.length && !skuData?.items.edges.length) {
      showBottomSheet(1);
    }
  }, [
    upcError,
    skuError,
    upcData,
    skuData,
    setSearching,
    setSearchError,
    showBottomSheet,
    t,
  ]);

  // Handle loading state from both queries
  useEffect(() => {
    if (upcLoading || skuLoading) {
      setSearching(true);
    } else {
      // Also covers queries that complete without finding a result.
      setSearching(false);
    }
  }, [upcLoading, skuLoading, setSearching]);

  const handleAddItem = async (formData: AddItemFormData) => {
    // Store brand name for use in mutation callback
    pendingBrandNameRef.current = formData.brandName;

    stashPendingFormImages(formData);

    // A refusal leaves the stashed images and brand name behind, so both are
    // dropped with it; `onCompleted` consumes them on success.
    await settleMutation(
      () =>
        addNewItem({
          variables: { input: mapFormToCreateItemInput(formData) },
        }),
      {
        document: CreateItemDocument,
        fallback: t('errors.addItemFailed'),
        onFailed: () => {
          cleanupPendingImageStorage();
          pendingBrandNameRef.current = undefined;
        },
      },
    );
  };

  // Re-runs the query that failed; its outcome reaches the error effect above,
  // so the promise carries nothing to handle.
  const handleRetry = () => {
    setSearchError(null);
    if (upcError) {
      refetchUpc().catch(() => {});
    } else if (skuError) {
      refetchSku().catch(() => {});
    }
  };

  return {
    searchResults,
    loading: upcLoading || skuLoading,
    addingItem,
    handleAddItem,
    handleRetry,
    clearSearch,
  };
};
