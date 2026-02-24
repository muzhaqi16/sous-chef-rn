import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BottomSheetKeyboardAwareScrollView } from '#components/atoms/BottomSheetKeyboardAwareScrollView';
import { StyleSheet } from 'react-native-unistyles';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';

import { LoadingState } from '#components/barcode/LoadingState';
import { ErrorState } from '#components/barcode/ErrorState';
import { ItemNotFound } from '#components/barcode/ItemNotFound';
import { SearchResults } from '#components/barcode/SearchResults';
import { Header } from '#components/molecules/Header';
import AddItemForm from '#components/organisms/AddItemForm/AddItemForm';
import type { StaticScreenProps } from '@react-navigation/native';
import { useAppStore, selectBottomSheetState } from '#store/useAppStore';
import { useSearchResults } from '#hooks/useSearchResults';
import { useShallow } from 'zustand/react/shallow';

export const SearchResultsScreen: React.FC<StaticScreenProps<{
  barcode: string;
  format: string;
  source?: 'pantry' | 'shoppingList';
  pantryId?: string;
  shoppingListId?: string;
}>> = ({ route }) => {
  const { barcode, format, source, pantryId, shoppingListId } = route.params;

  const { goBack, navigation } = useAppNavigation();

  // PERFORMANCE: Group bottom sheet state with useShallow (Zustand v5 API)
  const {
    scannerSheetVisible,
    searchError,
    isSearching,
    hideBottomSheet,
    showBottomSheet,
  } = useAppStore(useShallow(selectBottomSheetState));

  const { ref: bottomSheetRef, modalProps } = useStandardBottomSheet({
    onDismiss: hideBottomSheet,
    snapPoints: ['50%', '65%', '85%'],
  });

  const {
    searchResults,
    loading,
    addingItem,
    handleAddItem,
    handleRetry,
    clearSearch,
  } = useSearchResults(barcode, format);

  // Hide bottom sheet when search results are found or barcode changes
  // This prevents the AddItemForm from showing when there's already a match
  useEffect(() => {
    if (searchResults.length > 0 && scannerSheetVisible) {
      hideBottomSheet();
    }
  }, [searchResults.length, scannerSheetVisible, hideBottomSheet]);

  // Handle bottom sheet changes
  useEffect(() => {
    if (scannerSheetVisible) {
      bottomSheetRef.current?.present();
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [scannerSheetVisible]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleScanAnother = () => {
    clearSearch();
    goBack(); // Pop SearchResults and return to existing BarcodeScanner
  };

  const handleBackPress = () => {
    // Simply pop the Barcode stack to reveal Home
    // This preserves Home's state without triggering remounts
    const rootNavigator = navigation.getParent()?.getParent();
    if (rootNavigator?.canGoBack()) {
      rootNavigator.goBack();
    } else {
      goBack();
    }
  };

  const handleShowAddItemForm = () => {
    showBottomSheet(1);
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
            icon: 'qr-code-outline',
            onPress: handleScanAnother,
          },
        ]}
      />
      {renderContent()}

      <BottomSheetModal
        ref={bottomSheetRef}
        {...modalProps}
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.bottomSheetHandle}
      >
        <BottomSheetKeyboardAwareScrollView
          style={styles.bottomSheetContent}
          keyboardShouldPersistTaps="handled"
          bottomOffset={16}
        >
          <AddItemForm
            barcode={barcode}
            format={format}
            onSubmit={handleAddItem}
            onClose={hideBottomSheet}
            loading={addingItem}
          />
        </BottomSheetKeyboardAwareScrollView>
      </BottomSheetModal>
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
