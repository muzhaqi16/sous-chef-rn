import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { BottomSheetModal } from '#hooks/useStandardBottomSheet';
import { StyleSheet } from 'react-native-unistyles';
import type { StaticScreenProps } from '@react-navigation/native';

import { BottomSheetKeyboardAwareScrollView } from '#components/atoms/BottomSheetKeyboardAwareScrollView';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { Header } from '#components/molecules/Header';
import AddItemForm, {
  type AddItemFormInitialData,
} from '#components/organisms/AddItemForm/AddItemForm';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useMutation, useLazyQuery } from '@apollo/client/react';
import {
  CreateItemDocument,
  SearchBrandsDocument,
} from '#operations/item/item.generated';
import { useImageUpload } from '#hooks/useImageUpload';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import { alertService } from '#/services/alertService';
import { toastService } from '#/services/toastService';
import {
  mapFormToCreateItemInput,
  stashPendingFormImages,
  uploadPendingImages,
  cleanupPendingImageStorage,
} from '#/utils/items/createItemMapping';
import type { BarcodeSource } from '#/types/navigation';

export const IdentifiedItemFormScreen: React.FC<
  StaticScreenProps<{
    name: string;
    brandName?: string;
    netWeights?: Array<{ value: number; unitName: string }>;
    /** Populated when the BarcodeScanner pops back after a successful scan. */
    upc?: string;
    source?: BarcodeSource;
    pantryId?: string;
    shoppingListId?: string;
  }>
> = ({ route }) => {
  const { name, brandName, netWeights, upc } = route.params;
  const { goBack, navigation, toBarcode } = useAppNavigation();

  const handleScanUpc = () => {
    toBarcode({ returnTo: 'identify-form' });
  };

  const { uploadItemImage } = useImageUpload();

  const { ref: bottomSheetRef, modalProps } = useStandardBottomSheet({
    visible: true,
    onDismiss: goBack,
    snapPoints: ['65%', '85%'],
    keyboardBehavior: 'extend',
  });

  // Resolve the raw OCR'd brand text against the catalog so we capture a
  // proper brandId when the user's scan matches a known brand. Falls back to
  // the raw text when there's no match.
  const [searchBrands] = useLazyQuery(SearchBrandsDocument);
  const [resolvedBrand, setResolvedBrand] = useState<{
    id?: string;
    name: string;
  } | null>(brandName ? { name: brandName } : null);

  useEffect(() => {
    if (!brandName) return;
    searchBrands({ variables: { search: brandName, limit: 5 } }).then(res => {
      const edges = res.data?.brands?.edges ?? [];
      const exact = edges.find(
        e => e.node.name.toLowerCase() === brandName.toLowerCase(),
      );
      const match = exact ?? edges[0];
      if (match) {
        setResolvedBrand({ id: match.node.id, name: match.node.name });
      }
    });
  }, [brandName, searchBrands]);

  const [addNewItem, { loading }] = useMutation(CreateItemDocument, {
    onCompleted: async data => {
      const createdItem = data.createItem?.item;
      if (!createdItem) return;
      await executeMutation(
        () => uploadPendingImages(createdItem, uploadItemImage),
        'IdentifiedItemFormScreen.uploadPendingImages',
      );
      cleanupPendingImageStorage();
      toastService.success('Item added');
      const rootNavigator = navigation.getParent();
      if (rootNavigator?.canGoBack()) {
        rootNavigator.goBack();
      } else {
        goBack();
      }
    },
    onError: error => {
      cleanupPendingImageStorage();
      alertService.alert('Error', `Failed to add item: ${error.message}`);
    },
  });

  const initialData: AddItemFormInitialData = {
    name,
    vendor: resolvedBrand?.name ?? brandName,
    brandName: resolvedBrand?.name ?? brandName,
    brandId: resolvedBrand?.id,
    netWeights,
    upc,
  };

  const handleSubmit = async (formData: any) => {
    stashPendingFormImages(formData);
    await executeMutation(
      () =>
        addNewItem({
          variables: { input: mapFormToCreateItemInput(formData) },
        }),
      'IdentifiedItemFormScreen.addNewItem',
    );
  };

  const handleBack = () => {
    const rootNavigator = navigation.getParent();
    if (rootNavigator?.canGoBack()) {
      rootNavigator.goBack();
    } else {
      goBack();
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Review Item" onBack={handleBack} />
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
            mode="create"
            initialData={initialData}
            onSubmit={handleSubmit}
            onClose={handleBack}
            loading={loading}
            title="Review & Save"
            onScanUpc={handleScanUpc}
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
