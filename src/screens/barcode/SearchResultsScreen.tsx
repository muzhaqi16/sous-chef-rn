import React, { useRef, useEffect } from 'react';
import { View, Dimensions } from 'react-native';
import { useAppNavigation } from '#hooks';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { StyleSheet } from 'react-native-unistyles';

import {
  Header,
  LoadingState,
  ErrorState,
  ItemNotFound,
  SearchResults,
} from '#components/barcode';
import AddItemForm from '#components/organisms/AddItemForm';
import { type BarcodeStackParamList } from '#navigation/stacks/BarcodeStack';
import { useAppStore } from '#store/useAppStore';
import { useSearchResults } from '#hooks';

export const SearchResultsScreen: React.FC<{
  route: { params: BarcodeStackParamList['SearchResults'] };
}> = ({ route }) => {
  const { barcode, format, source, pantryId, shoppingListId } = route.params;

  const { navigate, navigateTo, navigateToNested } = useAppNavigation();

  const bottomSheetRef = useRef<BottomSheet>(null);

  const bottomSheetVisible = useAppStore(state => state.bottomSheetVisible);
  const searchError = useAppStore(state => state.searchError);
  const bottomSheetIndex = useAppStore(state => state.bottomSheetIndex);
  const isSearching = useAppStore(state => state.isSearching);
  const hideBottomSheet = useAppStore(state => state.hideBottomSheet);
  const showBottomSheet = useAppStore(state => state.showBottomSheet);

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
    navigate('BarcodeScanner', {
      source,
      pantryId,
      shoppingListId,
    });
  };

  const handleBackPress = () => {
    // Navigate back to the appropriate screen based on source
    if (source === 'pantry') {
      navigateToNested('Home', 'Pantry');
    } else if (source === 'shoppingList') {
      navigateToNested('Home', 'ShoppingList');
    } else {
      // Fallback to normal back navigation
      navigateTo.barcodeScanner();
    }
  };

  const handleShowAddItemForm = () => {
    showBottomSheet(1);
  };

  const renderBackdrop = (props: any) => (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      opacity={0.3}
      statusBarTranslucent={true}
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

    return <ItemNotFound barcode={barcode} onAddItem={handleShowAddItemForm} />;
  };

  return (
    <View style={styles.container}>
      <Header
        title="Search Results"
        onBackPress={handleBackPress}
        onScanPress={handleScanAnother}
      />
      {renderContent()}

      {bottomSheetVisible && (
        <BottomSheet
          ref={bottomSheetRef}
          snapPoints={['50%', '65%', '85%']}
          maxDynamicContentSize={Dimensions.get('window').height * 0.85}
          enablePanDownToClose
          animateOnMount={true}
          onClose={hideBottomSheet}
          backgroundStyle={styles.bottomSheetBackground}
          handleIndicatorStyle={styles.bottomSheetHandle}
          backdropComponent={renderBackdrop}
        >
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
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  bottomSheetBackground: {
    backgroundColor: theme.colors.surface,
  },
  bottomSheetHandle: {
    backgroundColor: theme.colors.border,
  },
  bottomSheetContent: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
}));
