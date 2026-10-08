import React, { useState } from 'react';
import { useTranslation } from '#/i18n';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { BottomSheetModal } from '#hooks/useStandardBottomSheet';
import { BottomSheetFormScrollView } from '#components/atoms/BottomSheetFormScrollView';
import { StyleSheet } from 'react-native-unistyles';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';

import { LoadingBranded } from '#components/molecules/Loading';
import { ErrorState } from '#components/molecules/ErrorState';
import { ItemNotFound } from '../components/ItemNotFound';
import { SearchResults } from '../components/SearchResults';
import AddItemForm, {
  type AddItemFormMode,
  type AddItemFormInitialData,
} from '#features/catalog/ui/AddItemForm/AddItemForm';
import { SuggestEditForm } from '../components/SuggestEditForm';
import type { StaticScreenProps } from '@react-navigation/native';
import { useBottomSheetState } from '#features/barcode/store/barcodeScannerStore';
import { useSearchResults } from '../hooks/useSearchResults';
import type { BarcodeSource, ScannedItem } from '#features/barcode/types';
import type { ScannedPack } from '#utils/items/suggestItemChanges';
import { Screen } from '#components/templates/Screen';
import { writesItemDirectly } from '#domain/itemWriteAccess';

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

/** The pack the scanned barcode's record reported, for a correction of it. */
function scannedPackOf(item: ScannedItem): ScannedPack | undefined {
  if (!item.variationId) return undefined;
  return {
    netWeight: item.netWeight,
    netWeightKind: item.netWeightKind,
    displayUnit: item.displayUnit,
    brandId: item.brandId,
    brandName: item.brandName,
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

  const { scannerSheetVisible, hideBottomSheet, showBottomSheet } =
    useBottomSheetState();

  const { ref: bottomSheetRef, modalProps } = useStandardBottomSheet({
    visible: scannerSheetVisible,
    onDismiss: hideBottomSheet,
    snapPoints: ['50%', '65%', '85%'],
  });

  const { item, loading, error, addingItem, handleAddItem, handleRetry } =
    useSearchResults(barcode, format, pantryId);

  // Pop SearchResults and return to the scanner beneath it.
  const handleScanAnother = () => goBack();

  const handleBackPress = () => {
    // Dismiss the Barcode modal stack to reveal Home
    const rootNavigator = navigation.getParent();
    if (rootNavigator?.canGoBack()) {
      rootNavigator.goBack();
    } else {
      goBack();
    }
  };

  const openSheet = (mode: AddItemFormMode) => {
    setSheetMode(mode);
    showBottomSheet();
  };

  const formInitialData =
    item && sheetMode === 'variant'
      ? buildInitialDataFromItem(item)
      : undefined;

  // Cosmetic only — the sheet re-reads the flags from the item's snapshot.
  const editActionLabel =
    item && writesItemDirectly(item)
      ? t('labels.edit')
      : t('labels.suggestEdit');

  // Withholding onEditItem drops the action rather than offering an edit that
  // could only be refused on submit.
  const isReadOnly = !!item && !item.canEdit && !item.canSuggest;

  const renderContent = () => {
    if (loading && !item) {
      return (
        <LoadingBranded
          message={t('searchResults.searching')}
          submessage={
            barcode ? t('barcode.barcodeValue', { barcode }) : undefined
          }
        />
      );
    }

    if (item) {
      return (
        <SearchResults
          item={item}
          format={format}
          onScanAnother={handleScanAnother}
          onEditItem={isReadOnly ? undefined : () => openSheet('edit')}
          onCreateVariant={() => openSheet('variant')}
          editActionLabel={editActionLabel}
          source={source}
          pantryId={pantryId}
          shoppingListId={shoppingListId}
        />
      );
    }

    if (error) {
      return (
        <ErrorState
          title={t('errors.searchFailed')}
          message={error}
          onRetry={handleRetry}
        />
      );
    }

    return (
      <ItemNotFound barcode={barcode} onAddItem={() => openSheet('create')} />
    );
  };

  return (
    <Screen
      header={{
        title: t('searchResults.title'),
        back: handleBackPress,
        actions: [
          {
            icon: 'qr-code-outline',
            accessibilityLabel: t('labels.scanAnother'),
            onPress: handleScanAnother,
          },
        ],
      }}
      scroll="none"
    >
      {renderContent()}

      <BottomSheetModal
        ref={bottomSheetRef}
        {...modalProps}
        stackBehavior="push"
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.bottomSheetHandle}
      >
        <BottomSheetFormScrollView
          style={styles.bottomSheetContent}
          keyboardShouldPersistTaps="handled"
        >
          {sheetMode === 'edit' && item ? (
            <SuggestEditForm
              key={`edit-${item.id}`}
              itemId={item.id}
              barcode={barcode}
              format={format}
              scan={scannedPackOf(item)}
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
        </BottomSheetFormScrollView>
      </BottomSheetModal>
    </Screen>
  );
};

const styles = StyleSheet.create(theme => ({
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
