import type {
  BaseDimension,
  CreateItemInput,
  ItemNetWeightInput,
  ItemType,
  ItemUnitInput,
  StorageState,
} from '#/graphql/generated/schemaTypes';
import type { ImageFile } from '#hooks/useImageUpload';
import { useStore } from '#store';

/**
 * Shape of the dynamic AddItemForm submission fields this mapper reads. The
 * form collects an open-ended bag of values (hence the index signature); the
 * named fields document the ones the mapper assigns into the strongly-typed
 * CreateItemInput.
 */
export interface AddItemFormData {
  [key: string]: unknown;
  name: string;
  description?: string;
  type?: ItemType;
  brandId?: string;
  brandName?: string;
  storageState?: StorageState;
  tags?: string[];
  categoryIds?: string[];
  primaryUpc?: string;
  shelfLifeDays?: number;
  shelfLifeOpenedDays?: number;
  baseDimension?: BaseDimension;
  defaultConsumeIncrement?: number;
  defaultConsumeUnitId?: string;
  netWeights?: ItemNetWeightInput[];
  units?: ItemUnitInput[];
  imageUrl?: string;
  sku?: string;
  storeId?: string;
}

/**
 * Maps an AddItemForm submission to the nested CreateItemInput shape accepted
 * by the backend. Shared by both the barcode-scanned flow and the identified-
 * from-OCR flow so the mapping stays in one place.
 */
export function mapFormToCreateItemInput(
  formData: Record<string, unknown>,
): CreateItemInput {
  const data = formData as AddItemFormData;
  return {
    name: data.name,
    description: data.description || undefined,
    type: data.type || undefined,
    brand:
      data.brandId || data.brandName
        ? { brandId: data.brandId, brandName: data.brandName }
        : undefined,
    classification:
      data.storageState || data.tags?.length || data.categoryIds?.length
        ? {
            storageState: data.storageState || undefined,
            tags: data.tags?.length ? data.tags : undefined,
            categoryIds: data.categoryIds?.length
              ? data.categoryIds
              : undefined,
          }
        : undefined,
    productDetails:
      data.primaryUpc || data.shelfLifeDays || data.shelfLifeOpenedDays
        ? {
            primaryUpc: data.primaryUpc || undefined,
            shelfLifeDays: data.shelfLifeDays || undefined,
            shelfLifeOpenedDays: data.shelfLifeOpenedDays || undefined,
          }
        : undefined,
    packageInfo:
      data.baseDimension ||
      data.defaultConsumeIncrement ||
      data.defaultConsumeUnitId
        ? {
            baseDimension: data.baseDimension || undefined,
            defaultConsumeIncrement: data.defaultConsumeIncrement || undefined,
            defaultConsumeUnitId: data.defaultConsumeUnitId || undefined,
          }
        : undefined,
    netWeights: data.netWeights?.length ? data.netWeights : undefined,
    unitConfig: data.units?.length ? { units: data.units } : undefined,
    media: data.imageUrl ? { imageUrl: data.imageUrl } : undefined,
    storeSkus:
      data.sku && data.storeId
        ? [{ sku: data.sku, storeId: data.storeId }]
        : undefined,
  };
}

/**
 * Hold the images the form selected until the create mutation returns an id to
 * attach them to.
 */
export function stashPendingFormImages(
  formData: Record<string, unknown>,
): void {
  const selectedImages = formData.selectedImages;
  if (Array.isArray(selectedImages) && selectedImages.length > 0) {
    useStore.getState().setPendingItemImages(selectedImages);
  } else if (formData.selectedImage) {
    useStore
      .getState()
      .setPendingItemImages([formData.selectedImage as ImageFile]);
  }
}

/**
 * Upload pending images from MMKV for a freshly-created item. Module-level so
 * the try-catch stays outside hook bodies (React Compiler bailout guard).
 */
export async function uploadPendingImages<
  T extends { id: string; imageUrl?: string | null },
>(
  createdItem: T,
  uploadItemImages: (
    images: Array<ImageFile & { perspective?: string }>,
    itemId: string,
  ) => Promise<Array<{ imageUrl: string }>>,
): Promise<T> {
  let finalItem = createdItem;

  const pending = useStore.getState().pendingItemImages;
  if (pending && pending.length > 0 && createdItem.id) {
    // Stashed from the multi-image picker, so each entry carries the angle the
    // user assigned it. Forwarding it is what orders the item's gallery.
    //
    // One batch call rather than a loop: the presign endpoint caps at 20/minute,
    // and a per-photo loop pops one alert each and keeps spending the hourly
    // budget after the cap trips.
    const uploaded = await uploadItemImages(pending, createdItem.id);
    const firstImageUrl = uploaded[0]?.imageUrl ?? null;
    if (firstImageUrl) {
      finalItem = { ...createdItem, imageUrl: firstImageUrl };
    }
  }

  return finalItem;
}

export function cleanupPendingImageStorage(): void {
  useStore.getState().setPendingItemImages(null);
}
