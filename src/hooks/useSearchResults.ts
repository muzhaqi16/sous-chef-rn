import { useEffect } from 'react';
import {
  useItemByUpcQuery,
  useItemBySkuQuery,
  useCreateItemMutation,
  CreateItemMutation,
} from '#generated';
import { useStore } from '../store';
import { ScannedItem } from '../store/slices/barcodeScannerSlice';
import { Alert } from 'react-native';
import { useImageUpload } from './useImageUpload';
import { storage } from '#/storage/mmkv';

// Helper function to convert GraphQL Item to ScannedItem
const convertToScannedItem = (
  item: {
    id: string;
    name: string;
    description?: string | null;
    imageUrl?: string | null;
    upc?: string | null;
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
  upc: item.upc || fallbackBarcode,
  unitId: item.units?.find((u: any) => u.isDefault)?.unitId || undefined,
});

export const useSearchResults = (barcode: string) => {
  const {
    searchResults,
    setSearching,
    addToRecentlyScanned,
    hideBottomSheet,
    clearSearch,
    setSearchError,
    showBottomSheet,
    setSearchResults,
    // selectedPantryId: _selectedPantryId, // TODO: Use for context-aware search
  } = useStore();

  const { uploadItemImage } = useImageUpload();
  // const _client = useApolloClient(); // TODO: Use for direct Apollo operations if needed

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
        Alert.alert('Success', 'Item added successfully!');
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
  } = useItemByUpcQuery({
    variables: { upc: barcode },
  });

  const {
    data: skuData,
    loading: skuLoading,
    error: skuError,
  } = useItemBySkuQuery({
    variables: { sku: barcode, storeId: undefined },
    skip: !!upcData?.itemByUpc, // Skip SKU search if UPC search found a result
  });

  // Handle UPC query completion
  useEffect(() => {
    if (upcData && upcData?.itemByUpc) {
      setSearching(false);
      const item = convertToScannedItem(upcData.itemByUpc, barcode);
      setSearchResults([item]);
      addToRecentlyScanned(item);
      hideBottomSheet();
    }
  }, [
    upcData,
    barcode,
    setSearching,
    setSearchResults,
    addToRecentlyScanned,
    hideBottomSheet,
  ]);

  // Handle SKU query completion
  useEffect(() => {
    if (skuData) {
      console.log('SKU search completed:', {
        barcode,
        foundItem: !!skuData.itemBySku,
        itemData: skuData.itemBySku,
      });

      setSearching(false);
      if (skuData.itemBySku) {
        const item = convertToScannedItem(skuData.itemBySku, barcode);
        setSearchResults([item]);
        addToRecentlyScanned(item);
        hideBottomSheet();
      } else {
        // Neither UPC nor SKU found anything
        setSearchResults([]);
        showBottomSheet(1);
      }
    }
  }, [
    skuData,
    barcode,
    setSearching,
    setSearchResults,
    addToRecentlyScanned,
    hideBottomSheet,
    showBottomSheet,
  ]);

  // Handle errors from both queries
  useEffect(() => {
    if (upcError && skuError) {
      setSearching(false);
      setSearchError(`Search failed: ${upcError.message}`);
      showBottomSheet(1);
    }
  }, [upcError, skuError, setSearching, setSearchError, showBottomSheet]);

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
        upc: formData.upc || barcode,
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
