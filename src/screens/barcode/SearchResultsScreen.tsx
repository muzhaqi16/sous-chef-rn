import React, {useRef, useEffect} from 'react';
import {SafeAreaView, StatusBar} from 'react-native';
import {useNavigationFlow} from '#hooks';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import {StyleSheet} from 'react-native-unistyles';

import {
  Header,
  LoadingState,
  ErrorState,
  ItemNotFound,
  SearchResults,
} from '#components/barcode';
import AddItemForm from '#components/pages/AddItemForm';
import {SearchResultsScreenProps, SearchResultsNavProp} from '#navigation';
import {useStore} from '#store';
import {useSearchResults} from '#hooks';

export const SearchResultsScreen: React.FC<SearchResultsScreenProps> = ({
  route,
}) => {
  const {barcode, format, source, pantryId, shoppingListId} = route.params;

  const {
    navigateWithinStack,
    navigateToPantry,
    navigateToShoppingList,
  } = useNavigationFlow();

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

  // Handle status bar styling based on backdrop visibility
  useEffect(() => {
    if (bottomSheetVisible) {
      StatusBar.setBarStyle('dark-content', true);
    } else {
      StatusBar.setBarStyle('light-content', true);
    }
  }, [bottomSheetVisible]);

  const handleScanAnother = () => {
    clearSearch();
    navigateWithinStack('BarcodeScanner', {
      source,
      pantryId,
      shoppingListId,
    });
  };

  const handleBackPress = () => {
    // Navigate back to the appropriate screen based on source
    if (source === 'pantry') {
      navigateToPantry();
    } else if (source === 'shoppingList') {
      navigateToShoppingList();
    } else {
      // Fallback to normal back navigation
      navigateWithinStack('BarcodeScanner');
    }
  };

  const renderBackdrop = (props: any) => (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      opacity={0.3}
    />
  );

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
          source={source}
          pantryId={pantryId}
          shoppingListId={shoppingListId}
        />
      );
    }

    return <ItemNotFound barcode={barcode} />;
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Search Results"
        onBackPress={handleBackPress}
        onScanPress={handleScanAnother}
      />
      {renderContent()}

      {bottomSheetVisible && (
        <BottomSheet
          ref={bottomSheetRef}
          snapPoints={['50%', '65%', '90%']}
          enablePanDownToClose
          animateOnMount={true}
          onClose={hideBottomSheet}
          backgroundStyle={styles.bottomSheetBackground}
          handleIndicatorStyle={styles.bottomSheetHandle}
          backdropComponent={renderBackdrop}>
          <BottomSheetScrollView style={styles.bottomSheetContent}>
            <AddItemForm
              barcode={barcode}
              format={format}
              onSubmit={handleAddItem}
              onClose={hideBottomSheet}
              loading={addingItem}
            />
          </BottomSheetScrollView>
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
