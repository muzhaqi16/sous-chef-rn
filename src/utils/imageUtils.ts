import type { ItemImage, ImageSize, ImageTab } from '#/types/nutrition';

/**
 * Extracts the image URL from an item
 * The API resolver populates the imageUrl field with the appropriate image
 *
 * @param item - Item object with imageUrl field
 * @returns Image URL or null if no image is available
 */
export const getItemImageUrl = (item: any): string | null => {
  const imageUrl = item?.imageUrl;
  if (!imageUrl) return null;

  // Only return valid URLs - filenames without full path are invalid
  // The API should be returning full CDN URLs, not just filenames
  if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
    console.warn('[getItemImageUrl] Invalid imageUrl (not a full URL):', imageUrl);
    return null;
  }

  return imageUrl;
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

// =============================================================================
// IMAGE SIZE SELECTION
// =============================================================================

type PreferredSize = ImageSize['size'];

const SIZE_PRIORITY: PreferredSize[] = [
  'large',
  'xlarge',
  'medium',
  'small',
  'thumbnail',
];

/**
 * Get best available image URL for a given image, preferring the specified size
 */
export function getBestImageUrl(
  image: ItemImage,
  preferredSize: PreferredSize = 'large',
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
function getPerspectiveLabel(perspective: string): string {
  const labels: Record<string, string> = {
    front: 'Front',
    back: 'Back',
    left: 'Left',
    right: 'Right',
    top: 'Top',
    nutrition_label: 'Nutrition',
    ingredient_list: 'Ingredients',
  };
  return labels[perspective] || perspective.charAt(0).toUpperCase() + perspective.slice(1);
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
    'top',
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
