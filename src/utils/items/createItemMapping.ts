import type { CreateItemInput } from '#/graphql/generated/schemaTypes';
import type { ImageFile } from '#hooks/useImageUpload';
import { storage } from '#/storage/mmkv';

/**
 * Maps an AddItemForm submission to the nested CreateItemInput shape accepted
 * by the backend. Shared by both the barcode-scanned flow and the identified-
 * from-OCR flow so the mapping stays in one place.
 */
// formData is a dynamic AddItemForm submission; each field is read untyped and
// assigned to the strongly-typed CreateItemInput. Tightening to
// Record<string, unknown> would require casting ~20 fields one-by-one, a
// substantial refactor of the mapping body.
export function mapFormToCreateItemInput(
  formData: Record<string, any>,
): CreateItemInput {
  return {
    name: formData.name,
    description: formData.description || undefined,
    type: formData.type || undefined,
    brand:
      formData.brandId || formData.brandName
        ? { brandId: formData.brandId, brandName: formData.brandName }
        : undefined,
    classification:
      formData.storageState ||
      formData.tags?.length ||
      formData.categoryIds?.length
        ? {
            storageState: formData.storageState || undefined,
            tags: formData.tags?.length ? formData.tags : undefined,
            categoryIds: formData.categoryIds?.length
              ? formData.categoryIds
              : undefined,
          }
        : undefined,
    productDetails:
      formData.primaryUpc ||
      formData.vendor ||
      formData.shelfLifeDays ||
      formData.shelfLifeOpenedDays
        ? {
            primaryUpc: formData.primaryUpc || undefined,
            vendor: formData.vendor || undefined,
            shelfLifeDays: formData.shelfLifeDays || undefined,
            shelfLifeOpenedDays: formData.shelfLifeOpenedDays || undefined,
          }
        : undefined,
    packageInfo:
      formData.baseDimension ||
      formData.defaultConsumeIncrement ||
      formData.defaultConsumeUnitId
        ? {
            baseDimension: formData.baseDimension || undefined,
            defaultConsumeIncrement:
              formData.defaultConsumeIncrement || undefined,
            defaultConsumeUnitId: formData.defaultConsumeUnitId || undefined,
          }
        : undefined,
    netWeights: formData.netWeights?.length ? formData.netWeights : undefined,
    unitConfig: formData.units?.length ? { units: formData.units } : undefined,
    media: formData.imageUrl ? { imageUrl: formData.imageUrl } : undefined,
    storeSkus:
      formData.sku && formData.storeId
        ? [{ sku: formData.sku, storeId: formData.storeId }]
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
