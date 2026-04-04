import React, { useEffect, useState } from 'react';
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
import AddItemForm, {
  type AddItemFormMode,
  type AddItemFormInitialData,
} from '#components/organisms/AddItemForm/AddItemForm';
import type { StaticScreenProps } from '@react-navigation/native';
import { useAppStore, selectBottomSheetState } from '#store/useAppStore';
import { useSearchResults } from '#hooks/useSearchResults';
import { useShallow } from 'zustand/react/shallow';
import type { BarcodeSource } from '#/types/navigation';
import type { ScannedItem } from '#/store/slices/barcodeScannerSlice';

/** Build form initialData from a ScannedItem for edit/variant modes */
function buildInitialDataFromItem(item: ScannedItem): AddItemFormInitialData {
  return {
    name: item.name,
    description: item.description,
    upc: item.upc,
    vendor: item.brandName,
    brandId: item.brandId,
    brandName: item.brandName,
    imageUrl: item.imageUrl,
    type: item.type,
    storageState: item.storageState,
    shelfLifeDays: item.shelfLifeDays,
    shelfLifeOpenedDays: item.shelfLifeOpenedDays,
    tags: item.tags,
    categoryIds: item.categories?.map(c => c.id),
  };
}

export const SearchResultsScreen: React.FC<
  StaticScreenProps<{
    barcode: string;
    format: string;
    source?: BarcodeSource;
    pantryId?: string;
    shoppingListId?: string;
  }>
> = ({ route }) => {
  const { barcode, format, source, pantryId, shoppingListId } = route.params;

  const { goBack, navigation } = useAppNavigation();

  const [sheetMode, setSheetMode] = useState<AddItemFormMode>('create');

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
    suggestingEdit,
    handleAddItem,
    handleSuggestEdit,
    handleRetry,
    clearSearch,
  } = useSearchResults(barcode, format);

  // Hide bottom sheet when search results are found or barcode changes
  // This prevents the AddItemForm from showing when there's already a match
  // Only auto-hide for initial search results, not after edit/variant actions
  useEffect(() => {
    if (
      searchResults.length > 0 &&
      scannerSheetVisible &&
      sheetMode === 'create'
    ) {
      hideBottomSheet();
    }
  }, [searchResults.length, scannerSheetVisible, hideBottomSheet, sheetMode]);

  // Handle bottom sheet changes
  useEffect(() => {
    if (scannerSheetVisible) {
      bottomSheetRef.current?.present();
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [scannerSheetVisible, bottomSheetRef]);

  const handleScanAnother = () => {
    clearSearch();
    goBack(); // Pop SearchResults and return to existing BarcodeScanner
  };

  const handleBackPress = () => {
    // Dismiss the Barcode modal stack to reveal Home
    const rootNavigator = navigation.getParent('Barcode');
    if (rootNavigator?.canGoBack()) {
      rootNavigator.goBack();
    } else {
      goBack();
    }
  };

  const handleShowAddItemForm = () => {
    setSheetMode('create');
    showBottomSheet(1);
  };

  const handleEditItem = () => {
    setSheetMode('edit');
    showBottomSheet(1);
  };

  const handleCreateVariant = () => {
    setSheetMode('variant');
    showBottomSheet(1);
  };

  const handleFormSubmit = (formData: any) => {
    if (sheetMode === 'edit' && searchResults[0]) {
      handleSuggestEdit(searchResults[0].id, formData);
    } else {
      handleAddItem(formData);
    }
  };

  const currentItem = searchResults[0];
  const formInitialData =
    currentItem && sheetMode !== 'create'
      ? buildInitialDataFromItem(currentItem)
      : undefined;

  const formLoading = sheetMode === 'edit' ? suggestingEdit : addingItem;

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
          onEditItem={handleEditItem}
          onCreateVariant={handleCreateVariant}
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
            key={sheetMode}
            barcode={barcode}
            format={format}
            mode={sheetMode}
            initialData={formInitialData}
            onSubmit={handleFormSubmit}
            onClose={hideBottomSheet}
            loading={formLoading}
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
