import type { ItemImage, ImageSize, ImageTab } from '#/types/nutrition';

// =============================================================================
// IMAGE SIZE SELECTION
// =============================================================================

export type PreferredSize = ImageSize['size'];

type ImageVariant = { url: string; kind?: string | null };

const SIZE_PRIORITY: PreferredSize[] = [
  'small',
  'medium',
  'large',
  'xlarge',
  'thumbnail',
];

const PREFERRED_SIZE_TO_KIND: Partial<Record<PreferredSize, string>> = {
  thumbnail: 'THUMBNAIL',
  small: 'THUMBNAIL',
  medium: 'SIZE_512',
  large: 'SIZE_512',
};

/**
 * Pick the best URL from API-generated image variants.
 * Falls back to MAIN kind if the preferred kind is missing.
 */
export function pickImageUrl(
  images: ImageVariant[] | null | undefined,
  preferredKind: string,
): string | null {
  if (!images || images.length === 0) return null;
  return (
    images.find(img => img.kind === preferredKind)?.url ??
    images.find(img => img.kind === 'MAIN')?.url ??
    null
  );
}

/**
 * Resolves the best available image URL from any common data shape.
 * Handles: Item (direct), PantryItem/ShoppingListItem (nested .item),
 * PantryItemSuggestion (own imageUrl + nested .item fallback).
 *
 * @param preferredSize - Preferred image size. Defaults to 'small' for list/card
 *   contexts. Pass 'large' for detail/gallery screens.
 */
export function resolveImageUrl(
  source:
    | {
        imageUrl?: string | null;
        images?: unknown;
        item?: { imageUrl?: string | null; images?: unknown } | null;
      }
    | null
    | undefined,
  preferredSize: PreferredSize = 'small',
): string | null {
  if (!source) return null;

  const kind = PREFERRED_SIZE_TO_KIND[preferredSize];

  // 1. Try API-generated variants from nested .item.images
  if (kind && Array.isArray(source.item?.images)) {
    const variant = pickImageUrl(source.item.images as ImageVariant[], kind);
    if (variant) return variant;
  }

  // 2. Try API-generated variants from own images array
  if (kind && Array.isArray(source.images)) {
    const variant = pickImageUrl(source.images as ImageVariant[], kind);
    if (variant) return variant;
  }

  // 3. Try own imageUrl (validates it's a full URL)
  const ownUrl = source.imageUrl;
  if (
    ownUrl &&
    (ownUrl.startsWith('http://') || ownUrl.startsWith('https://'))
  ) {
    return ownUrl;
  }

  // 4. Try nested .item via getItemImageUrl (handles imageUrl + legacy images fallback)
  if (source.item) {
    const fromItem = getItemImageUrl(source.item, preferredSize);
    if (fromItem) return fromItem;
  }

  // 5. Try own images array via legacy path (for direct Item objects)
  if (source.images) {
    return getItemImageUrl(source, preferredSize);
  }

  return null;
}

export const getItemImageUrl = (
  item: { imageUrl?: string | null; images?: unknown } | null | undefined,
  preferredSize: PreferredSize = 'small',
): string | null => {
  // 1. Try API-generated variants first
  const kind = PREFERRED_SIZE_TO_KIND[preferredSize];
  if (kind && Array.isArray(item?.images)) {
    const variant = pickImageUrl(item.images as ImageVariant[], kind);
    if (variant) return variant;
  }

  // 2. Try imageUrl (original upload)
  const imageUrl = item?.imageUrl;
  if (imageUrl) {
    // Only return valid URLs - filenames without full path are invalid
    // The API should be returning full CDN URLs, not just filenames
    if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      console.warn(
        '[getItemImageUrl] Invalid imageUrl (not a full URL):',
        imageUrl,
      );
      return null;
    }
    return imageUrl;
  }

  // 3. Fallback: extract from legacy images JSON array (perspective/sizes structure)
  if (item?.images) {
    const parsed = parseImages(item.images);
    const primary = getPrimaryImage(parsed);
    if (primary) {
      return getBestImageUrl(primary, preferredSize);
    }
  }

  return null;
};

// =============================================================================
// IMAGE ARRAY PARSING
// =============================================================================

/**
 * Parse JSON images field to typed ItemImage array
 */
export function parseImages(imagesJson: unknown): ItemImage[] {
  if (!imagesJson || !Array.isArray(imagesJson)) {
    return [];
  }

  return imagesJson.filter(
    (img): img is ItemImage =>
      img &&
      typeof img === 'object' &&
      typeof img.perspective === 'string' &&
      Array.isArray(img.sizes),
  );
}

/**
 * Check if images array has any valid images
 */
export function hasImages(images: ItemImage[]): boolean {
  return images.length > 0 && images.some(img => img.sizes.length > 0);
}

/**
 * Get best available image URL for a given image, preferring the specified size.
 * Falls back through SIZE_PRIORITY order if preferred size is unavailable.
 */
export function getBestImageUrl(
  image: ItemImage,
  preferredSize: PreferredSize = 'small',
): string | null {
  if (!image.sizes || image.sizes.length === 0) {
    return null;
  }

  // Try preferred size first
  const preferred = image.sizes.find(s => s.size === preferredSize);
  if (preferred) {
    return preferred.url;
  }

  // Fall back through priority order
  for (const size of SIZE_PRIORITY) {
    const found = image.sizes.find(s => s.size === size);
    if (found) {
      return found.url;
    }
  }

  // Last resort: return first available
  return image.sizes[0]?.url ?? null;
}

/**
 * Get primary/featured image from array
 */
export function getPrimaryImage(images: ItemImage[]): ItemImage | null {
  // First try featured image
  const featured = images.find(img => img.featured);
  if (featured) return featured;

  // Then try front perspective
  const front = images.find(img => img.perspective === 'front');
  if (front) return front;

  // Return first available
  return images[0] ?? null;
}

// =============================================================================
// TABBED GALLERY GROUPING
// =============================================================================

/**
 * Get display label for a perspective
 */
export function getPerspectiveLabel(perspective: string): string {
  const labels: Record<string, string> = {
    front: 'Front',
    back: 'Back',
    left: 'Left',
    right: 'Right',
    nutrition_label: 'Nutrition',
    ingredient_list: 'Ingredients',
  };
  return (
    labels[perspective] ||
    perspective.charAt(0).toUpperCase() + perspective.slice(1)
  );
}

/**
 * Group images by perspective for tabbed gallery display
 */
export function groupImagesByPerspective(images: ItemImage[]): ImageTab[] {
  const groups = new Map<string, ItemImage[]>();

  for (const image of images) {
    const key = image.perspective;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(image);
  }

  // Define perspective display order
  const perspectiveOrder = [
    'front',
    'back',
    'left',
    'right',
    'nutrition_label',
    'ingredient_list',
  ];

  return Array.from(groups.entries())
    .sort(([a], [b]) => {
      const aIndex = perspectiveOrder.indexOf(a);
      const bIndex = perspectiveOrder.indexOf(b);
      // Unknown perspectives go to the end
      const aOrder = aIndex === -1 ? 999 : aIndex;
      const bOrder = bIndex === -1 ? 999 : bIndex;
      return aOrder - bOrder;
    })
    .map(([key, imgs]) => ({
      key,
      label: getPerspectiveLabel(key),
      images: imgs,
    }));
}
