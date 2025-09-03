import {useEffect} from 'react';
import {
  useSearchItemsByBarcodeQuery,
  useCreateItemMutation,
} from '../graphql/generated';
import {useStore} from '../store';
import {ScannedItem} from '../store/slices/barcodeScannerSlice';
import {Alert} from 'react-native';

// Helper function to convert GraphQL Item to ScannedItem
const convertToScannedItem = (
  item: any,
  fallbackBarcode: string,
): ScannedItem => ({
  id: item.id,
  name: item.name,
  description: item.description || undefined,
  imageUrl: item.imageUrl || undefined,
  barcode: item.barcode || fallbackBarcode,
  price: item.averagePrice || undefined,
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

  const {data, loading, error} = useSearchItemsByBarcodeQuery({
    variables: {barcode},
    onCompleted: data => {
      setSearching(false);
      if (data.searchItemsByBarcode) {
        const item = convertToScannedItem(data.searchItemsByBarcode, barcode);
        setSearchResults([item]);
        addToRecentlyScanned(item);
      } else {
        setSearchResults([]);
        showBottomSheet(1);
      }
    },
    onError: error => {
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
        barcode: formData.barcode || barcode,
        sku: formData.sku || undefined,
        fdcId: formData.fdcId || undefined,

        // Classification
        type: formData.type || undefined,
        storageState: formData.storageState || undefined,
        dataSource: formData.dataSource || undefined,
        status: formData.status || undefined,
        visibility: formData.visibility || undefined,

        // Product Details
        shelfLifeDays: formData.shelfLifeDays || undefined,
        displayItemSize: formData.displayItemSize || undefined,

        // Images
        imageUrl: formData.imageUrl || undefined,

        // Pricing (convert to numbers)
        price: formData.price
          ? parseFloat(formData.price.toString())
          : undefined,
        averagePrice: formData.averagePrice
          ? parseFloat(formData.averagePrice.toString())
          : undefined,
        minPrice: formData.minPrice
          ? parseFloat(formData.minPrice.toString())
          : undefined,
        maxPrice: formData.maxPrice
          ? parseFloat(formData.maxPrice.toString())
          : undefined,
        unitPrice: formData.unitPrice
          ? parseFloat(formData.unitPrice.toString())
          : undefined,
        displayPricePerUnit: formData.displayPricePerUnit || undefined,
        comparedPrice: formData.comparedPrice
          ? parseFloat(formData.comparedPrice.toString())
          : undefined,

        // Brand Information
        brandId: formData.brandId || undefined,
        vendor: formData.vendor || undefined,

        // Units
        unitQty: formData.unitQty
          ? parseFloat(formData.unitQty.toString())
          : undefined,
        defaultUnit: formData.defaultUnit || undefined,

        // Metadata
        tags: (() => {
          let tags: string[] = [];
          
          // Include existing tags
          if (formData.tags && Array.isArray(formData.tags)) {
            tags = [...formData.tags];
          } else if (formData.tags && typeof formData.tags === 'string') {
            tags = formData.tags.split(',').map((tag: string) => tag.trim()).filter(Boolean);
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
        popularity: formData.popularity
          ? parseInt(formData.popularity.toString())
          : undefined,

        // Store-specific
        inventoryStatus: formData.inventoryStatus || undefined,
        fulfillmentMethods: formData.fulfillmentMethods || undefined,
        productLocation: formData.productLocation || undefined,

        // Health claims
        healthClaims: formData.healthClaims || undefined,

        // Boolean flags (only include the ones we want to send to API)
        showInOnboarding: formData.showInOnboarding || false,

        // Tracking
        externalId: formData.externalId || undefined,
        lastSyncedAt: formData.lastSyncedAt || undefined,
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
