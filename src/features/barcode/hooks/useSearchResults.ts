import { useEffect, useRef } from 'react';
import {
  useItemByUpcFilterQuery,
  useItemBySkuFilterQuery,
  useCreateItemMutation,
  useFlagItemForReviewMutation,
  CreateItemMutation,
  UpcFormat,
} from '#generated';
import { useSearchState, useBottomSheetState } from '#store/useAppStore';
import { ScannedItem } from '../store/barcodeScannerSlice';
import { alertService } from '#/services/alertService';
import { useImageUpload } from '#hooks/useImageUpload';
import { storage } from '#/storage/mmkv';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import {
  mapFormToCreateItemInput,
  stashPendingFormImages,
  uploadPendingImages as sharedUploadPendingImages,
  cleanupPendingImageStorage as sharedCleanupPendingImageStorage,
} from '#/utils/items/createItemMapping';

// Map Vision Camera barcode format to GraphQL UpcFormat enum
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
    item.brands?.[0]?.brand?.name ??
    item.variationBrand?.name ??
    undefined;

  // For brand ID, only use matchedVariation.brandInfo.id if it's a non-null string
  const effectiveBrandId =
    (item.matchedVariation?.brandInfo?.id ?? null) ||
    (item.brands?.[0]?.brand?.id ?? item.variationBrand?.id ?? undefined);

  return {
    id: item.id,
    name: item.name,
    description: item.description || undefined,
    imageUrl: item.imageUrl || undefined,
    upc: item.primaryUpc || fallbackBarcode,
    unitId: item.units?.find(u => u.isDefault)?.unitId || undefined,
    netWeight: effectiveNetWeight,
    displayUnit: effectiveDisplayUnit,
    brandName: effectiveBrandName,
    brandId: effectiveBrandId,
    type: item.type || undefined,
    storageState: item.storageState || undefined,
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

/** Build a human-readable reason string from form corrections */
function buildSuggestEditReason(formData: Record<string, unknown>): string {
  const parts: string[] = [];
  if (formData.editReason) {
    parts.push(String(formData.editReason));
  }
  const fields: Array<[string, string]> = [
    ['name', 'Name'],
    ['vendor', 'Brand'],
    ['primaryUpc', 'UPC'],
  ];
  for (const [key, label] of fields) {
    if (formData[key]) {
      parts.push(`${label}: ${formData[key]}`);
    }
  }
  if (
    formData.netWeights &&
    Array.isArray(formData.netWeights) &&
    formData.netWeights.length > 0
  ) {
    const weights = formData.netWeights
      .map((w: any) => `${w.value} ${w.unitName}`)
      .join(', ');
    parts.push(`Net Weight: ${weights}`);
  }
  return parts.join(' | ') || 'User suggested corrections';
}

/** Build a corrected ScannedItem from form data */
function buildCorrectedScannedItem(
  original: ScannedItem,
  formData: Record<string, unknown>,
): ScannedItem {
  return {
    ...original,
    name: (formData.name as string) || original.name,
    description: (formData.description as string) || original.description,
    brandName:
      (formData.vendor as string) ||
      (formData.brandName as string) ||
      original.brandName,
    brandId: (formData.brandId as string) || original.brandId,
    imageUrl: (formData.imageUrl as string) || original.imageUrl,
    upc: (formData.primaryUpc as string) || original.upc,
    type: (formData.type as string) || original.type,
    storageState: (formData.storageState as string) || original.storageState,
    shelfLifeDays: (formData.shelfLifeDays as number) ?? original.shelfLifeDays,
    shelfLifeOpenedDays:
      (formData.shelfLifeOpenedDays as number) ?? original.shelfLifeOpenedDays,
    tags: (formData.tags as string[]) || original.tags,
  };
}

export const useSearchResults = (barcode: string, format?: string) => {
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

  const { uploadItemImage } = useImageUpload();

  // Ref to store brand name from form for use in mutation callback
  const pendingBrandNameRef = useRef<string | undefined>(undefined);

  // Clear previous search results when barcode changes to prevent showing stale data
  useEffect(() => {
    setSearchResults([]);
    setSearchError(null);
    setSearching(true);
  }, [barcode, setSearchResults, setSearchError, setSearching]);

  const [addNewItem, { loading: addingItem }] = useCreateItemMutation({
    onCompleted: async (data: CreateItemMutation) => {
      if (data.createItem?.item) {
        const createdItem = data.createItem.item;

        // Upload pending images (module-level function avoids try-catch in hook)
        const result = await executeMutation(
          () => uploadPendingImages(createdItem, uploadItemImage),
          'Error handling pending image upload:',
        );
        const finalItem = result !== false ? result : createdItem;
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
    onError: error => {
      cleanupPendingImageStorage();
      pendingBrandNameRef.current = undefined;

      alertService.alert('Error', `Failed to add item: ${error.message}`);
    },
  });

  const {
    data: upcData,
    loading: upcLoading,
    error: upcError,
  } = useItemByUpcFilterQuery({
    variables: { upc: barcode, upcFormat },
    fetchPolicy: 'network-only', // Always fetch fresh - prevents stale data from previous scans
  });

  // Get first item from UPC filter results
  const upcItem = upcData?.items?.edges?.[0]?.node;

  const {
    data: skuData,
    loading: skuLoading,
    error: skuError,
  } = useItemBySkuFilterQuery({
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

    const skuItem = skuData?.items?.edges?.[0]?.node;

    // Only process after loading completes to avoid acting on stale data
    // Apollo's data field retains previous values during loading
    if (!skuLoading && skuData) {
      console.log('SKU search completed:', {
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

  // Handle errors from both queries (including network errors and timeouts)
  useEffect(() => {
    if (upcError || skuError) {
      const error = upcError || skuError;
      const hasNetworkError = error && 'networkError' in error;
      const errorMessage = error?.message || '';
      const isTimeoutError = errorMessage.toLowerCase().includes('timeout');

      setSearching(false);

      if (isTimeoutError) {
        setSearchError('Search timed out. Please try again.');
      } else if (hasNetworkError) {
        setSearchError(
          'Unable to search. Please check your connection and try again.',
        );
      } else {
        // Show error message for any query failure
        setSearchError(`Search failed: ${errorMessage || 'Unknown error'}`);
      }

      // Only show bottom sheet if we have an error and no results
      if (!upcData?.items?.edges?.length && !skuData?.items?.edges?.length) {
        showBottomSheet(1);
      }
    }
  }, [
    upcError,
    skuError,
    upcData,
    skuData,
    setSearching,
    setSearchError,
    showBottomSheet,
  ]);

  // Handle loading state from both queries
  useEffect(() => {
    if (upcLoading || skuLoading) {
      setSearching(true);
    } else if (!upcLoading && !skuLoading) {
      // Both queries are done, ensure searching is false
      // This handles the case where queries complete but don't find results
      setSearching(false);
    }
  }, [upcLoading, skuLoading, setSearching]);

  const handleAddItem = async (formData: any) => {
    // Store brand name for use in mutation callback
    pendingBrandNameRef.current = formData.brandName;

    stashPendingFormImages(formData);

    await executeMutation(
      () =>
        addNewItem({
          variables: { input: mapFormToCreateItemInput(formData) },
        }),
      'Error adding item:',
    );
  };

  const [flagItem, { loading: suggestingEdit }] =
    useFlagItemForReviewMutation();

  const handleSuggestEdit = async (itemId: string, formData: any) => {
    const reason = buildSuggestEditReason(formData);

    // Store images for upload if provided
    if (formData.selectedImages && formData.selectedImages.length > 0) {
      storage.set(
        'temp_pending_item_images',
        JSON.stringify(formData.selectedImages),
      );
    }

    const result = await executeMutation(
      () => flagItem({ variables: { itemId, reason } }),
      'Error flagging item for review:',
    );

    if (result !== false) {
      // Upload images if any were selected
      if (formData.selectedImages?.length > 0) {
        await executeMutation(
          () =>
            uploadPendingImages(
              { id: itemId, imageUrl: null },
              uploadItemImage,
            ),
          'Error uploading images for suggestion:',
        );
      }
      cleanupPendingImageStorage();

      // Update local display with corrected data
      const currentItem = searchResults[0];
      if (currentItem) {
        const correctedItem = buildCorrectedScannedItem(currentItem, formData);
        setSearchResults([correctedItem]);
      }

      hideBottomSheet();
      alertService.alert(
        'Thank You',
        'Your suggestion has been submitted for review.',
      );
    }
  };

  const handleRetry = () => {
    setSearchError(null);
    // Add refetch logic here
  };

  return {
    searchResults,
    loading: upcLoading || skuLoading,
    error: upcError || skuError,
    addingItem,
    suggestingEdit,
    handleAddItem,
    handleSuggestEdit,
    handleRetry,
    clearSearch,
  };
};
