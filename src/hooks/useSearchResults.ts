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
      await addNewItem({
        variables: {
          input: {
            ...formData,
            barcode,
            price: parseFloat(formData.price) || 0,
          },
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
