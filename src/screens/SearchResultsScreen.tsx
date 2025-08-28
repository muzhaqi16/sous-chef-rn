import React, {useRef, useEffect} from 'react';
import {SafeAreaView} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import BottomSheet, {BottomSheetView} from '@gorhom/bottom-sheet';
import {StyleSheet} from 'react-native-unistyles';

import {
  Header,
  LoadingState,
  ErrorState,
  ItemNotFound,
  SearchResults,
} from '../components/barcode';
import AddItemForm from '../components/pages/AddItemForm';
import {SearchResultsScreenProps, SearchResultsNavProp} from '../navigation';
import {useStore} from '../store';
import {useSearchResults} from '../hooks';

const SearchResultsScreen: React.FC<SearchResultsScreenProps> = ({route}) => {
  const {barcode, format} = route.params;

  const navigation = useNavigation<SearchResultsNavProp>();

  const bottomSheetRef = useRef<BottomSheet>(null);

  const {
    bottomSheetVisible,
    searchError,
    bottomSheetIndex,
    isSearching,
    hideBottomSheet,
  } = useStore();

  const {
    searchResults,
    loading,
    addingItem,
    handleAddItem,
    handleRetry,
    clearSearch,
  } = useSearchResults(barcode);

  // Handle bottom sheet changes
  useEffect(() => {
    if (bottomSheetVisible && bottomSheetRef.current) {
      bottomSheetRef.current.expand();
    } else if (bottomSheetRef.current) {
      bottomSheetRef.current.close();
    }
  }, [bottomSheetVisible, bottomSheetIndex]);

  const handleScanAnother = () => {
    clearSearch();
    navigation.navigate('BarcodeScanner');
  };

  const renderContent = () => {
    if (isSearching || loading) {
      return <LoadingState message="Searching for item..." barcode={barcode} />;
    }

    if (searchError && !searchResults.length) {
      return (
        <ErrorState
          title="Search Error"
          message={searchError}
          onRetry={handleRetry}
        />
      );
    }

    if (searchResults.length > 0) {
      return (
        <SearchResults
          item={searchResults[0]}
          format={format}
          onScanAnother={handleScanAnother}
        />
      );
    }

    return <ItemNotFound barcode={barcode} />;
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Search Results"
        onBackPress={() => navigation.goBack()}
        onScanPress={handleScanAnother}
      />
      {renderContent()}

      {bottomSheetVisible && (
        <BottomSheet
          ref={bottomSheetRef}
          snapPoints={['50%', '90%']}
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

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
}));

export default SearchResultsScreen;
