import { useEffect } from 'react';
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
  },
  fallbackBarcode: string,
): ScannedItem => ({
  id: item.id,
  name: item.name,
  description: item.description || undefined,
  imageUrl: item.imageUrl || undefined,
  upc: item.primaryUpc || fallbackBarcode,
  unitId: item.units?.find((u) => u.isDefault)?.unitId || undefined,
  netWeight: item.netWeight ?? undefined,
  displayUnit: item.displayUnit
    ? {
        id: item.displayUnit.id,
        name: item.displayUnit.name,
        symbol: item.displayUnit.symbol,
      }
    : undefined,
  brandName: item.brands?.[0]?.brand?.name ?? undefined,
});

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

  // Clear previous search results when barcode changes to prevent showing stale data
  useEffect(() => {
    setSearchResults([]);
    setSearchError(null);
    setSearching(true);
  }, [barcode, setSearchResults, setSearchError, setSearching]);

  const [addNewItem, { loading: addingItem }] = useCreateItemMutation({
    onCompleted: async (data: CreateItemMutation) => {
      if (data.createItem) {
        const createdItem = data.createItem;
        let finalItem = createdItem;

        // If there was an image selected, upload it after item creation
        try {
          const pendingImageUpload = storage.getString(
            'temp_pending_item_image',
          );
          if (pendingImageUpload && createdItem.id) {
            const imageFile = JSON.parse(pendingImageUpload);

            const imageUrl = await uploadItemImage(imageFile, createdItem.id);
            if (imageUrl) {
              // Update the finalItem with the new image URL for display
              finalItem = { ...createdItem, imageUrl };
            }
          }
        } catch (error) {
          console.error('Error handling pending image upload:', error);
          // Continue without showing error since item was created successfully
        } finally {
          // Clean up the temporary storage
          storage.remove('temp_pending_item_image');
        }

        const newItem = convertToScannedItem(finalItem, barcode);
        setSearchResults([newItem]);
        addToRecentlyScanned(newItem);
        hideBottomSheet();
      }
    },
    onError: error => {
      // Clean up pending image upload on error
      storage.remove('temp_pending_item_image');

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
    skip: !!upcItem, // Skip SKU search if UPC search found a result
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
    setSearching,
    setSearchResults,
    addToRecentlyScanned,
    hideBottomSheet,
    showBottomSheet,
  ]);

  // Handle errors from both queries (including network errors for offline scenarios)
  useEffect(() => {
    if (upcError || skuError) {
      const error = (upcError || skuError) as any;
      const isNetworkError = error?.networkError;

      setSearching(false);

      if (isNetworkError) {
        setSearchError('Unable to search. Please check your connection and try again.');
      } else if (upcError && skuError) {
        // Both queries failed with non-network errors
        setSearchError(`Search failed: ${upcError.message}`);
      }

      // Only show bottom sheet if we have an error and no results
      if (!upcData?.items?.edges?.length && !skuData?.items?.edges?.length) {
        showBottomSheet(1);
      }
    }
  }, [upcError, skuError, upcData, skuData, setSearching, setSearchError, showBottomSheet]);

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
      // Store the selected image in MMKV for post-creation upload
      if (formData.selectedImage) {
        storage.set(
          'temp_pending_item_image',
          JSON.stringify(formData.selectedImage),
        );
      }

      // Process the form data to match the CreateItemInput type
      const processedInput = {
        name: formData.name,
        description: formData.description || undefined,
        primaryUpc: formData.upc || barcode,
        sku: formData.sku || undefined,

        // Classification
        type: formData.type || undefined,
        storageState: formData.storageState || undefined,

        // Product Details
        shelfLifeDays: formData.shelfLifeDays || undefined,
        displayItemSize: formData.displayItemSize || undefined,

        // Images
        imageUrl: formData.imageUrl || undefined,

        // Brand Information
        brandId: formData.brandId || undefined,
        vendor: formData.vendor || undefined,

        // Weight and Units
        netWeight: formData.netWeight || undefined,
        displayUnitId: formData.displayUnitId || undefined,

        // Categories
        categoryIds: formData.categoryIds || undefined,

        // Units array
        units: formData.units || undefined,

        // Metadata
        tags: (() => {
          let tags: string[] = [];

          // Include existing tags
          if (formData.tags && Array.isArray(formData.tags)) {
            tags = [...formData.tags];
          } else if (formData.tags && typeof formData.tags === 'string') {
            tags = formData.tags
              .split(',')
              .map((tag: string) => tag.trim())
              .filter(Boolean);
          }

          // Add tags based on boolean flags
          if (formData.isFoodStampItem) {
            tags.push('food-stamp-eligible');
          }
          if (formData.isFsaEligible) {
            tags.push('fsa-eligible');
          }

          return tags.length > 0 ? tags : undefined;
        })(),
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
