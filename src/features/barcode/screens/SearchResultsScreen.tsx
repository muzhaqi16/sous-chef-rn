import React, { useEffect, useState } from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { BottomSheetModal } from '#hooks/useStandardBottomSheet';
import { BottomSheetKeyboardAwareScrollView } from '#components/atoms/BottomSheetKeyboardAwareScrollView';
import { StyleSheet } from 'react-native-unistyles';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';

import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '#components/atoms/ErrorState';
import { ItemNotFound } from '../components/ItemNotFound';
import { SearchResults } from '../components/SearchResults';
import { Header } from '#components/molecules/Header';
import AddItemForm, {
  type AddItemFormMode,
  type AddItemFormInitialData,
} from '#components/organisms/AddItemForm/AddItemForm';
import { SuggestEditForm } from '../components/SuggestEditForm';
import type { StaticScreenProps } from '@react-navigation/native';
import { useBottomSheetState } from '#store/useAppStore';
import { useSearchResults } from '../hooks/useSearchResults';
import type { BarcodeSource } from '#/types/navigation';
import type { ScannedItem } from '#store/slices/barcodeScannerSlice';

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

  const { t } = useTranslation();
  const { goBack, navigation } = useAppNavigation();

  const [sheetMode, setSheetMode] = useState<AddItemFormMode>('create');

  // PERFORMANCE: Group bottom sheet state with useShallow (Zustand v5 API)
  const {
    scannerSheetVisible,
    searchError,
    isSearching,
    hideBottomSheet,
    showBottomSheet,
  } = useBottomSheetState();

  const { ref: bottomSheetRef, modalProps } = useStandardBottomSheet({
    visible: scannerSheetVisible,
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

  const handleScanAnother = () => {
    clearSearch();
    goBack(); // Pop SearchResults and return to existing BarcodeScanner
  };

  const handleBackPress = () => {
    // Dismiss the Barcode modal stack to reveal Home
    const rootNavigator = navigation.getParent();
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

  const currentItem = searchResults[0];
  const formInitialData =
    currentItem && sheetMode === 'variant'
      ? buildInitialDataFromItem(currentItem)
      : undefined;

  // Cosmetic only — the sheet re-reads canEdit from the authoritative item
  // snapshot. It is absent on a cached scan, and the suggestion wording is the
  // safe default.
  const editActionLabel = currentItem?.canEdit
    ? t('labels.edit')
    : t('labels.suggestEdit');

  // A scan can surface an item this user may not touch — a PRIVATE one they
  // don't own — and neither write path accepts it. Withholding onEditItem drops
  // the action from the card rather than offering an edit that could only be
  // refused on submit.
  //
  // Only an explicit false on both hides it: a cached scan carries neither flag,
  // and the sheet loads the authoritative snapshot and shows the read-only state
  // if it turns out closed. Guessing "read-only" from a missing flag would strip
  // the action from items that are perfectly editable.
  const isReadOnly =
    currentItem?.canEdit === false && currentItem?.canSuggest === false;

  const renderContent = () => {
    if (isSearching || loading) {
      return (
        <LoadingState
          message={t('searchResults.searching')}
          barcode={barcode}
        />
      );
    }

    if (searchError && !searchResults.length) {
      return (
        <ErrorState
          title={t('errors.searchFailed')}
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
          onEditItem={isReadOnly ? undefined : handleEditItem}
          onCreateVariant={handleCreateVariant}
          editActionLabel={editActionLabel}
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
        title={t('searchResults.title')}
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
        stackBehavior="push"
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.bottomSheetHandle}
      >
        <BottomSheetKeyboardAwareScrollView
          style={styles.bottomSheetContent}
          keyboardShouldPersistTaps="handled"
        >
          {sheetMode === 'edit' && currentItem ? (
            <SuggestEditForm
              key={`edit-${currentItem.id}`}
              itemId={currentItem.id}
              barcode={barcode}
              format={format}
              onClose={hideBottomSheet}
            />
          ) : (
            <AddItemForm
              key={sheetMode}
              barcode={barcode}
              format={format}
              mode={sheetMode}
              initialData={formInitialData}
              onSubmit={handleAddItem}
              onClose={hideBottomSheet}
              loading={addingItem}
            />
          )}
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
