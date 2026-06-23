import type {
  BaseDimension,
  CreateItemInput,
  ItemNetWeightInput,
  ItemType,
  ItemUnitInput,
  StorageState,
} from '#/graphql/generated/schemaTypes';
import type { ImageFile } from '#hooks/useImageUpload';
import { storage } from '#/storage/mmkv';

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
  vendor?: string;
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
 * Stash images selected in the form into MMKV so the post-create upload step
 * can pick them up after the mutation returns with an item id.
 */
export function stashPendingFormImages(
  formData: Record<string, unknown>,
): void {
  const selectedImages = formData.selectedImages;
  if (Array.isArray(selectedImages) && selectedImages.length > 0) {
    storage.set('temp_pending_item_images', JSON.stringify(selectedImages));
  } else if (formData.selectedImage) {
    storage.set(
      'temp_pending_item_image',
      JSON.stringify(formData.selectedImage),
    );
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
  uploadItemImage: (image: ImageFile, itemId: string) => Promise<string | null>,
): Promise<T> {
  let finalItem = createdItem;

  const pendingImagesJson = storage.getString('temp_pending_item_images');
  if (pendingImagesJson && createdItem.id) {
    const images = JSON.parse(pendingImagesJson);
    let firstImageUrl: string | null = null;
    for (const image of images) {
      const imageUrl = await uploadItemImage(image, createdItem.id);
      if (imageUrl && !firstImageUrl) {
        firstImageUrl = imageUrl;
      }
    }
    if (firstImageUrl) {
      finalItem = { ...createdItem, imageUrl: firstImageUrl };
    }
  }

  const pendingImageUpload = storage.getString('temp_pending_item_image');
  if (pendingImageUpload && createdItem.id) {
    const imageFile = JSON.parse(pendingImageUpload);
    const imageUrl = await uploadItemImage(imageFile, createdItem.id);
    if (imageUrl) {
      finalItem = { ...createdItem, imageUrl };
    }
  }

  return finalItem;
}

export function cleanupPendingImageStorage(): void {
  storage.remove('temp_pending_item_images');
  storage.remove('temp_pending_item_image');
}
