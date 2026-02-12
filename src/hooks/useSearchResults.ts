import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/shallow';
import {
  useItemByUpcFilterQuery,
  useItemBySkuFilterQuery,
  useCreateItemMutation,
  CreateItemMutation,
  UpcFormat,
} from '#generated';
import {
  useAppStore,
  selectSearchState,
  selectBottomSheetState,
} from '#store/useAppStore';
import { ScannedItem } from '../store/slices/barcodeScannerSlice';
import { Alert } from 'react-native';
import { useImageUpload } from './useImageUpload';
import { storage } from '#/storage/mmkv';

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
  };
};

export const useSearchResults = (barcode: string, format?: string) => {
  const upcFormat = mapVisionCameraFormatToUpcFormat(format);
  const {
    searchResults,
    setSearching,
    addToRecentlyScanned,
    clearSearch,
    setSearchError,
    setSearchResults,
  } = useAppStore(useShallow(selectSearchState));
  const { showBottomSheet, hideBottomSheet } = useAppStore(
    useShallow(selectBottomSheetState),
  );

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
        let finalItem = createdItem;

        // If there were images selected, upload them after item creation
        try {
          const pendingImagesJson = storage.getString(
            'temp_pending_item_images',
          );
          if (pendingImagesJson && createdItem.id) {
            const images = JSON.parse(pendingImagesJson);
            let firstImageUrl: string | null = null;
            for (const image of images) {
              const imageUrl = await uploadItemImage(image, createdItem.id);
              if (imageUrl && !firstImageUrl) {
                firstImageUrl = imageUrl;
              }
            }
            if (firstImageUrl) {
              // Update the finalItem with the first image URL for display
              finalItem = { ...createdItem, imageUrl: firstImageUrl };
            }
          }

          // Backward compat: also check old singular key
          const pendingImageUpload = storage.getString(
            'temp_pending_item_image',
          );
          if (pendingImageUpload && createdItem.id) {
            const imageFile = JSON.parse(pendingImageUpload);
            const imageUrl = await uploadItemImage(imageFile, createdItem.id);
            if (imageUrl) {
              finalItem = { ...createdItem, imageUrl };
            }
          }
        } catch (error) {
          console.error('Error handling pending image upload:', error);
          // Continue without showing error since item was created successfully
        } finally {
          // Clean up both storage keys
          storage.remove('temp_pending_item_images');
          storage.remove('temp_pending_item_image');
        }

        const newItem = convertToScannedItem(
          finalItem,
          barcode,
          pendingBrandNameRef.current,
        );
        pendingBrandNameRef.current = undefined; // Clear after use
        setSearchResults([newItem]);
        addToRecentlyScanned(newItem);
        hideBottomSheet();
      }
    },
    onError: error => {
      // Clean up pending data on error
      storage.remove('temp_pending_item_images');
      storage.remove('temp_pending_item_image');
      pendingBrandNameRef.current = undefined;

      Alert.alert('Error', `Failed to add item: ${error.message}`);
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
      const error = (upcError || skuError) as any;
      const isNetworkError = error?.networkError;
      const errorMessage = error?.message || error?.networkError?.message || '';
      const isTimeoutError = errorMessage.toLowerCase().includes('timeout');

      setSearching(false);

      if (isTimeoutError) {
        setSearchError('Search timed out. Please try again.');
      } else if (isNetworkError) {
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
    try {
      // Store brand name for use in mutation callback
      pendingBrandNameRef.current = formData.brand?.brandName;

      // Store the selected images in MMKV for post-creation upload
      if (formData.selectedImages && formData.selectedImages.length > 0) {
        storage.set(
          'temp_pending_item_images',
          JSON.stringify(formData.selectedImages),
        );
      } else if (formData.selectedImage) {
        // Backward compat: support singular selectedImage
        storage.set(
          'temp_pending_item_image',
          JSON.stringify(formData.selectedImage),
        );
      }

      // Process the form data to match the new nested CreateItemInput structure
      const processedInput = {
        name: formData.name,
        description: formData.description || undefined,
        type: formData.type || undefined,

        // Brand reference
        brand: formData.brand || undefined,

        // Classification (storageState, categories, tags)
        classification: formData.classification || undefined,

        // Product details (primaryUpc, vendor, shelfLifeDays)
        productDetails: formData.productDetails || undefined,

        // Media (imageUrl)
        media: formData.media || undefined,

        // Net weights (manufacturer-provided dual-label values)
        netWeights: formData.netWeights || undefined,

        // Unit configuration
        unitConfig: formData.unitConfig || undefined,
      };

      await addNewItem({
        variables: {
          input: processedInput,
        },
      });
    } catch (error) {
      console.error('Error adding item:', error);
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
    handleAddItem,
    handleRetry,
    clearSearch,
  };
};
