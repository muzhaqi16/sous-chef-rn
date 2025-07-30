import React, {useRef, useMemo, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import BottomSheet, {BottomSheetView} from '@gorhom/bottom-sheet';
import {
  useSearchItemByBarcodeQuery,
  useCreateItemMutation,
} from '../graphql/generated';

import AddItemForm from '../components/pages/AddItemForm';
import {SearchResultsScreenProps} from '../navigation';
import {useStore} from '../store';

type NavigationProp = {
  navigate: (screen: string, params?: any) => void;
  goBack: () => void;
};

type RouteProps = {
  params: {
    barcode: string;
    format?: string;
  };
};

const SearchResultsScreen: React.FC<SearchResultsScreenProps> = ({route}) => {
  const {barcode, format} = route.params;
  const navigation = useNavigation<NavigationProp>();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const {
    searchResults,
    setSearching,
    addToRecentlyScanned,
    hideBottomSheet,
    clearSearch,
    setSearchError,
    showBottomSheet,
    bottomSheetVisible,
    searchError,
    bottomSheetIndex,
    isSearching,
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
        showBottomSheet(1); // Show "Add Item" sheet
      }
    },
    onError: error => {
      setSearching(false);
      setSearchError(error.message);
      showBottomSheet(1);
    },
  });

  // Set searching state when query starts
  useEffect(() => {
    if (loading) {
      setSearching(true);
    }
  }, [loading, setSearching]);

  // Handle bottom sheet changes
  useEffect(() => {
    console.log('Bottom sheet state changed:', {
      bottomSheetVisible,
      bottomSheetIndex,
    });
    if (bottomSheetVisible && bottomSheetRef.current) {
      // bottomSheetRef.current.snapToIndex(bottomSheetIndex);
      bottomSheetRef.current.expand();
    } else if (bottomSheetRef.current) {
      bottomSheetRef.current.close();
    }
  }, [bottomSheetVisible, bottomSheetIndex]);

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

  const handleScanAnother = () => {
    clearSearch();
    navigation.navigate('BarcodeScanner');
  };

  const handleRetry = () => {
    setSearchError(null);
    // Refetch the query
    // You might want to add a refetch function here
  };

  const renderContent = () => {
    if (isSearching || loading) {
      return (
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color="#62B1F6" />
          <Text style={styles.loadingText}>Searching for item...</Text>
          <Text style={styles.barcodeText}>Barcode: {barcode}</Text>
        </View>
      );
    }

    if (searchError && !searchResults.length) {
      return (
        <View style={styles.centeredContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>Search Error</Text>
          <Text style={styles.errorMessage}>{searchError}</Text>
          <TouchableOpacity style={styles.button} onPress={handleRetry}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (searchResults.length > 0) {
      const item = searchResults[0];
      return (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}>
          <View style={styles.itemCard}>
            {item.imageUrl ? (
              <Image source={{uri: item.imageUrl}} style={styles.itemImage} />
            ) : (
              <View style={styles.placeholderImage}>
                <Text style={styles.placeholderText}>📦</Text>
              </View>
            )}

            <View style={styles.itemDetails}>
              <Text style={styles.itemName}>{item.name}</Text>
              {item.description && (
                <Text style={styles.itemDescription}>{item.description}</Text>
              )}
              {item?.price && (
                <Text style={styles.itemPrice}>${item?.price.toFixed(2)}</Text>
              )}
              <Text style={styles.itemBarcode}>Barcode: {item.barcode}</Text>
              {format && (
                <Text style={styles.itemFormat}>Format: {format}</Text>
              )}
            </View>
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                // Handle add to cart or other primary action
                Alert.alert('Success', 'Item action completed!');
              }}>
              <Text style={styles.primaryButtonText}>Add to Cart</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleScanAnother}>
              <Text style={styles.secondaryButtonText}>Scan Another</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      );
    }

    // No results found - this case should trigger the bottom sheet
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.notFoundIcon}>🔍</Text>
        <Text style={styles.notFoundText}>Item Not Found</Text>
        <Text style={styles.notFoundMessage}>
          No item found with barcode: {barcode}
        </Text>
        <Text style={styles.addItemHint}>
          You can add this item to the database using the form below.
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Search Results</Text>
        <TouchableOpacity onPress={handleScanAnother}>
          <Text style={styles.scanButton}>Scan</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      {renderContent()}

      {/* Bottom Sheet for Adding New Item */}
      {bottomSheetVisible && (
        <BottomSheet
          ref={bottomSheetRef}
          snapPoints={['25%', '50%', '90%']}
          enablePanDownToClose
          animateOnMount={true}
          onClose={hideBottomSheet}
          backgroundStyle={styles.bottomSheetBackground}
          handleIndicatorStyle={styles.bottomSheetHandle}>
          <BottomSheetView style={styles.bottomSheetContent}>
            <AddItemForm
              barcode={barcode}
              format={format}
              onSubmit={handleAddItem}
              onClose={hideBottomSheet}
              loading={addingItem}
            />
          </BottomSheetView>
        </BottomSheet>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    color: '#62B1F6',
    fontSize: 16,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
  },
  scanButton: {
    color: '#62B1F6',
    fontSize: 16,
    fontWeight: '500',
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#495057',
    marginTop: 16,
    marginBottom: 8,
  },
  barcodeText: {
    fontSize: 14,
    color: '#6c757d',
    fontFamily: 'monospace',
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#dc3545',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 24,
  },
  notFoundIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  notFoundText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
  },
  notFoundMessage: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: 'monospace',
  },
  addItemHint: {
    fontSize: 14,
    color: '#62B1F6',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  itemCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 16,
  },
  placeholderImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  placeholderText: {
    fontSize: 48,
  },
  itemDetails: {
    gap: 8,
  },
  itemName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#212529',
  },
  itemDescription: {
    fontSize: 16,
    color: '#6c757d',
    lineHeight: 22,
  },
  itemPrice: {
    fontSize: 20,
    fontWeight: '600',
    color: '#28a745',
  },
  itemBarcode: {
    fontSize: 14,
    color: '#6c757d',
    fontFamily: 'monospace',
  },
  itemFormat: {
    fontSize: 12,
    color: '#adb5bd',
    textTransform: 'uppercase',
  },
  actionButtons: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#62B1F6',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'white',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#62B1F6',
  },
  secondaryButtonText: {
    color: '#62B1F6',
    fontSize: 16,
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#62B1F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  bottomSheetBackground: {
    backgroundColor: 'white',
  },
  bottomSheetHandle: {
    backgroundColor: '#dee2e6',
  },
  bottomSheetContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
});

export default SearchResultsScreen;
