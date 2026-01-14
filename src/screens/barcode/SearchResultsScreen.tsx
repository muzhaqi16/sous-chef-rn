import React, { useRef, useEffect } from 'react';
import { useApolloClient } from '@apollo/client/react';
import { View, Dimensions } from 'react-native';
import { useAppNavigation, useCrossTabNavigation, type CrossTabSource } from '#hooks';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { StyleSheet } from 'react-native-unistyles';

import {
  LoadingState,
  ErrorState,
  ItemNotFound,
  SearchResults,
} from '#components/barcode';
import { Header } from '#components/molecules/Header';
import AddItemForm from '#components/organisms/AddItemForm';
import { type BarcodeStackParamList } from '#navigation/stacks/BarcodeStack';
import { useAppStore, selectBottomSheetState } from '#store/useAppStore';
import { useSearchResults } from '#hooks';
import { useShallow } from 'zustand/react/shallow';

export const SearchResultsScreen: React.FC<{
  route: { params: BarcodeStackParamList['SearchResults'] };
}> = ({ route }) => {
  const { barcode, format, source, pantryId, shoppingListId } = route.params;

  const { navigate, navigateTo } = useAppNavigation();
  const { goBackToSource } = useCrossTabNavigation('BarcodeScanner');

  const bottomSheetRef = useRef<BottomSheet>(null);

  // PERFORMANCE: Group bottom sheet state with useShallow (Zustand v5 API)
  const {
    bottomSheetVisible,
    searchError,
    bottomSheetIndex,
    isSearching,
    hideBottomSheet,
    showBottomSheet,
  } = useAppStore(useShallow(selectBottomSheetState));

  const {
    searchResults,
    loading,
    addingItem,
    handleAddItem,
    handleRetry,
    clearSearch,
  } = useSearchResults(barcode, format);

  const apolloClient = useApolloClient();

  // Cleanup barcode search cache on unmount to prevent stale results
  useEffect(() => {
    return () => {
      // Evict barcode-related queries from cache to prevent stale results on next scan
      apolloClient.cache.evict({ fieldName: 'items' });
      apolloClient.cache.gc();
    };
  }, [apolloClient]);

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
    if (!source) {
      // Fallback to barcode scanner if no source
      navigateTo.barcodeScanner();
      return;
    }

    // Use cross-tab navigation hook for proper stack cleanup
    // Barcode is a modal stack - needs fromModalStack to fully dismiss
    const sourceData: CrossTabSource = {
      sourceTab: source === 'pantry' ? 'Pantry' : 'ShoppingList',
      fromModalStack: true,
    };

    goBackToSource(sourceData);
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
        onBack={handleBackPress}
        rightActions={[
          {
            icon: 'qr-code-scanner',
            onPress: handleScanAnother,
          },
        ]}
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
