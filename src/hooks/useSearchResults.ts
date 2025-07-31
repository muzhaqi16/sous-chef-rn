import {useEffect} from 'react';
import {
  useSearchItemByBarcodeQuery,
  useCreateItemMutation,
} from '../graphql/generated';
import {useStore} from '../store';
import {Alert} from 'react-native';

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
        const newItem = data.createItem;
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

  const {data, loading, error} = useSearchItemByBarcodeQuery({
    variables: {barcode},
    onCompleted: data => {
      setSearching(false);
      if (data.itemByBarcode) {
        const item = data.itemByBarcode;
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
