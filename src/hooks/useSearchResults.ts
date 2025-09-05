import {useEffect} from 'react';
import {useItemByUpcQuery, useCreateItemMutation, Item} from '#generated';
import {useStore} from '../store';
import {ScannedItem} from '../store/slices/barcodeScannerSlice';
import {Alert} from 'react-native';

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
  } = useStore();

  const [addNewItem, {loading: addingItem}] = useCreateItemMutation({
    onCompleted: data => {
      if (data.createItem) {
        const newItem = convertToScannedItem(data.createItem, barcode);
        setSearchResults([newItem]);
        addToRecentlyScanned(newItem);
        hideBottomSheet();
        Alert.alert('Success', 'Item added successfully!');
      }
    },
    onError: error => {
      Alert.alert('Error', `Failed to add item: ${error.message}`);
    },
  });

  const {data, loading, error} = useItemByUpcQuery({
    variables: {upc: barcode},
    onCompleted: data => {
      setSearching(false);
      if (data.itemByUpc) {
        // itemByUpc returns a single item, not an array
        const item = convertToScannedItem(data.itemByUpc, barcode);
        setSearchResults([item]);
        addToRecentlyScanned(item);
        // Make sure bottom sheet is hidden when item is found
        hideBottomSheet();
      } else {
        setSearchResults([]);
        showBottomSheet(1);
      }
    },
    onError: (error: any) => {
      setSearching(false);
      setSearchError(error.message);
      showBottomSheet(1);
    },
  });

  useEffect(() => {
    if (loading) {
      setSearching(true);
    }
  }, [loading, setSearching]);

  const handleAddItem = async (formData: any) => {
    try {
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
    loading,
    error,
    addingItem,
    handleAddItem,
    handleRetry,
    clearSearch,
  };
};
