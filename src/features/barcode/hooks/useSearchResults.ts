import { useEffect, useState } from 'react';
import {
  useApolloClient,
  useFragment,
  useMutation,
  useQuery,
} from '@apollo/client/react';

import { CreateItemDocument } from '#operations/item/item.generated';
import {
  ItemByLookupDocument,
  UseSearchResults_ItemFragmentDoc,
  type ItemByLookupQuery,
  type UseSearchResults_ItemFragment,
} from './useSearchResults.generated';
import { UpcFormat } from '#/graphql/generated/schemaTypes';
import { useBottomSheetState } from '#features/barcode/store/barcodeScannerStore';
import type { ScannedItem } from '#features/barcode/types';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { useTranslation } from '#/i18n';
import { useImageUpload } from '#hooks/useImageUpload';
import {
  mapFormToCreateItemInput,
  stashPendingFormImages,
  uploadPendingImages,
  cleanupPendingImageStorage,
  type AddItemFormData,
} from '#/utils/items/createItemMapping';
import { errorService } from '#/services/errorService';
import { alertService } from '#/services/alertService';
import type { AddItemFieldRefusal } from '#features/catalog/ui/AddItemForm/AddItemForm';
import { isNetworkError } from '#/utils/isNetworkError';
import { firstNonBlank } from '#/utils/firstNonBlank';
import { storeApi } from '#store';
import { blocksCacheMissQueries } from '#store/slices/networkSlice';

// Map Vision Camera barcode format to GraphQL UpcFormat enum.
// Source: react-native-vision-camera-barcode-scanner's BarcodeFormat
// ('ean-13' | 'ean-8' | 'upc-a' | 'upc-e' | 'qr-code' | …). BarcodeScannerScreen
// normalizes 'qr-code' → 'qr' before forwarding, so non-UPC formats fall through
// to the default branch and let the API auto-detect.
const mapVisionCameraFormatToUpcFormat = (
  format?: string,
): UpcFormat | undefined => {
  switch (format) {
    case 'ean-13':
      return UpcFormat.Ean_13;
    case 'ean-8':
      return UpcFormat.Ean_8;
    case 'upc-a':
      return UpcFormat.UpcA;
    case 'upc-e':
      return UpcFormat.UpcE;
    case undefined:
    default:
      return undefined; // Let API auto-detect
  }
};

type LookupNode = ItemByLookupQuery['items']['edges'][number]['node'];
type CreatedItem = UseSearchResults_ItemFragment;

/** A lookup's node, or a created item, which has none of the scanned pack's facts. */
type ResultItem = CreatedItem &
  Partial<Pick<LookupNode, Exclude<keyof LookupNode, keyof CreatedItem>>>;

/**
 * The card's full-width image: the primary photo, first in gallery order, at
 * its original size; else `imageUrl`, the item's only image. Each carries its
 * own credit.
 */
const cardImageOf = ({
  photos,
  imageUrl,
  imageCredit,
}: ResultItem): ScannedItem['image'] => {
  const [photo] = photos ?? [];
  if (photo) return { url: photo.url, credit: photo.credit ?? undefined };
  const url = firstNonBlank(imageUrl);
  return url ? { url, credit: imageCredit ?? undefined } : undefined;
};

/**
 * A lookup's item as a scan result. On a barcode lookup the size, its kind, its
 * unit and `variationBrand` are the scanned barcode's own (API
 * `barcodePackage`), so nothing here borrows another pack's figure or brand.
 */
const convertToScannedItem = (
  item: ResultItem,
  scannedCode: string,
  brandNameOverride?: string,
): ScannedItem => ({
  id: item.id,
  name: item.name,
  description: firstNonBlank(item.description),
  imageUrl: firstNonBlank(item.imageUrl),
  image: cardImageOf(item),
  dataAttributions: item.dataAttributions,
  canEdit: item.canEdit,
  canSuggest: item.canSuggest,
  upc: scannedCode,
  variationId: item.matchedVariation?.id,
  source: firstNonBlank(item.matchedVariation?.source),
  unitId: item.units.find(u => u.isDefault)?.unitId,
  netWeight: item.netWeight ?? undefined,
  netWeightKind: item.netWeightKind ?? undefined,
  displayUnit: item.displayUnit
    ? {
        id: item.displayUnit.id,
        name: item.displayUnit.name,
        symbol: item.displayUnit.symbol,
      }
    : undefined,
  trackingUnit: item.trackingUnit
    ? {
        id: item.trackingUnit.id,
        name: item.trackingUnit.name,
        symbol: item.trackingUnit.symbol,
      }
    : undefined,
  // The brand typed into the create form is the item's; a scan's is the
  // barcode's own.
  brandName: brandNameOverride ?? item.variationBrand?.name,
  brandId: brandNameOverride ? undefined : item.variationBrand?.id,
  type: item.type,
  storageState: item.storageState,
  shelfLifeDays: item.shelfLifeDays ?? undefined,
  shelfLifeOpenedDays: item.shelfLifeOpenedDays ?? undefined,
  tags: item.tags,
  categories: item.categories.map(c => ({
    id: c.category.id,
    name: c.category.name,
    isPrimary: c.isPrimary,
  })),
});

/** The item the scan's form created, the code it was made for, and its brand. */
interface Created {
  id: string;
  barcode: string;
  brandName?: string;
}

/** A failed lookup, and whether the app was blocking uncached reads when it landed. */
interface LabelledError {
  error: unknown;
  neverAsked: boolean;
}

/**
 * `pantryId` is where an add from the result lands, so the lookup can report the
 * unit that pantry would count the item in.
 */
export const useSearchResults = (
  barcode: string,
  format?: string,
  pantryId?: string,
) => {
  const { t } = useTranslation();
  const client = useApolloClient();
  const upcFormat = mapVisionCameraFormatToUpcFormat(format);
  const { showBottomSheet, hideBottomSheet } = useBottomSheetState();
  const { uploadItemImages } = useImageUpload();

  const [created, setCreated] = useState<Created | null>(null);
  const createdId = created?.barcode === barcode ? created.id : null;

  const [addNewItem, { loading: addingItem }] = useMutation(CreateItemDocument);

  const {
    data: upcData,
    loading: upcLoading,
    error: upcError,
    refetch: refetchUpc,
  } = useQuery(ItemByLookupDocument, {
    variables: {
      lookup: { upc: { code: barcode, format: upcFormat } },
      pantry: pantryId,
    },
    // `items` is keyed by `filters`, so another code's result never serves this
    // one; network-only is for a code the catalog has gained or changed since.
    fetchPolicy: 'network-only',
    refetchOn: false,
  });

  // Apollo keeps the previous code's data while the next one loads.
  const upcItem = upcLoading ? undefined : upcData?.items.edges[0]?.node;

  // A failed UPC lookup is not a miss, so an empty SKU answer never follows it.
  const skuSkipped = upcLoading || !!upcItem || !!upcError;
  const {
    data: skuData,
    loading: skuLoading,
    error: skuError,
    refetch: refetchSku,
  } = useQuery(ItemByLookupDocument, {
    variables: { lookup: { sku: { sku: barcode } }, pantry: pantryId },
    skip: skuSkipped,
    fetchPolicy: 'network-only', // As the UPC lookup above.
    refetchOn: false,
  });

  // A skipped query keeps its last run's data, which may be another code's.
  const skuAnswer = skuSkipped || skuLoading ? undefined : skuData;
  const skuItem = skuAnswer?.items.edges[0]?.node;
  const lookupError = upcError ?? (skuSkipped ? undefined : skuError);

  // Read live, so an edit of the created item reaches the card.
  const createdRead = useFragment({
    fragment: UseSearchResults_ItemFragmentDoc,
    fragmentName: 'useSearchResults_item',
    from: createdId ? { __typename: 'Item', id: createdId } : null,
  });

  const found: ResultItem | undefined = upcItem ?? skuItem;
  const item: ScannedItem | null =
    createdRead.complete && created
      ? convertToScannedItem(createdRead.data, barcode, created.brandName)
      : found
      ? convertToScannedItem(found, barcode)
      : null;

  // Before the SKU lookup answers, it is running or about to.
  const loading = upcLoading || (!skuSkipped && !skuAnswer && !skuError);
  const missed = !!skuAnswer && !skuItem && !createdId;

  // Offline, `offlineModeLink` answers the uncached lookup itself. Read when the
  // error lands, so reconnecting doesn't relabel that answer.
  const [labelled, setLabelled] = useState<LabelledError | null>(null);
  if (lookupError && labelled?.error !== lookupError) {
    setLabelled({
      error: lookupError,
      neverAsked: blocksCacheMissQueries(storeApi.getState()),
    });
  }
  const neverAsked =
    labelled !== null && labelled.error === lookupError && labelled.neverAsked;
  // `isNetworkError` covers the request timeout too. The server's own message is
  // unlocalized English, so the copy is always the app's.
  const errorCopy =
    neverAsked || isNetworkError(lookupError)
      ? t('errors.networkError')
      : t('errors.codes.genericRetry');

  // The create sheet stands open while both lookups have missed, and starts
  // closed whatever an earlier scan left it. A failed lookup is not a miss: the
  // product may well exist, so the screen offers a retry instead.
  useEffect(() => {
    if (missed) showBottomSheet();
    else hideBottomSheet();
  }, [missed, showBottomSheet, hideBottomSheet]);

  /** Uploads the form's photos to the item it created; the card shows the first. */
  const uploadCreatedItemImages = async (createdItem: {
    __typename: 'Item';
    id: string;
    imageUrl: string | null;
  }) => {
    let uploaded;
    try {
      uploaded = await uploadPendingImages(createdItem, uploadItemImages);
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Error handling pending image upload:',
      });
    }
    cleanupPendingImageStorage();
    const imageUrl = uploaded?.imageUrl;
    if (!imageUrl || imageUrl === createdItem.imageUrl) return;
    // The upload's confirm returns no item, so the card learns of the photo here.
    client.cache.modify({
      id: client.cache.identify(createdItem),
      fields: { imageUrl: () => imageUrl },
    });
  };

  const handleAddItem = async (
    formData: AddItemFormData,
  ): Promise<AddItemFieldRefusal | undefined> => {
    stashPendingFormImages(formData);

    const settled = await settleMutation(
      () =>
        addNewItem({
          variables: { input: mapFormToCreateItemInput(formData) },
        }),
      {
        document: CreateItemDocument,
        fallback: t('errors.addItemFailed'),
        present: 'none',
      },
    );
    const payload =
      settled.status === 'applied' ? appliedPayload(settled.data) : null;
    if (payload) {
      // The brand typed into the form is the new item's.
      setCreated({
        id: payload.item.id,
        barcode,
        brandName: formData.brandName,
      });
      hideBottomSheet();
      await uploadCreatedItemImages(payload.item);
      return undefined;
    }

    // Nothing was created for the stashed images to go to.
    cleanupPendingImageStorage();
    const { failure } = settled;
    if (settled.status !== 'failed' || !failure) return undefined;
    // An invalid barcode is the user's to fix, so it lands on the field.
    if (failure.field === 'primaryUpc') {
      return { field: 'upc', message: t('errors.field.primaryUpc') };
    }
    alertService.alert(failure.title, failure.body);
    return undefined;
  };

  // Re-runs the query that failed; its outcome reaches the result above, so the
  // promise carries nothing to handle.
  const handleRetry = () => {
    if (upcError) {
      refetchUpc().catch(() => {});
    } else if (skuError) {
      refetchSku().catch(() => {});
    }
  };

  return {
    item,
    loading,
    error: lookupError ? errorCopy : null,
    addingItem,
    handleAddItem,
    handleRetry,
  };
};
