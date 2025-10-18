/**
 * Extracts the best available image URL from an item's image data
 * Handles both the legacy imageUrl field and the new images array format
 *
 * @param item - Item object with imageUrl and/or images field
 * @param preferredSize - Preferred image size ('small', 'medium', 'large')
 * @returns Image URL or null if no image is available
 */
export const getItemImageUrl = (
  item: any,
  preferredSize: 'small' | 'medium' | 'large' = 'medium'
): string | null => {
  // Priority 1: Use imageUrl if available
  if (item?.imageUrl) return item.imageUrl;

  // Priority 2: Extract from images array
  if (item?.images && Array.isArray(item.images) && item.images.length > 0) {
    // Find featured image, or fall back to first image
    const selectedImage =
      item.images.find((img: any) => img.featured === true) || item.images[0];

    // Get URL from sizes array
    if (selectedImage?.sizes && Array.isArray(selectedImage.sizes)) {
      // Try to find the preferred size
      const preferredSizeImage = selectedImage.sizes.find(
        (s: any) => s.size === preferredSize
      );
      if (preferredSizeImage?.url) return preferredSizeImage.url;

      // Fallback to first available size
      if (selectedImage.sizes[0]?.url) return selectedImage.sizes[0].url;
    }
  }

  return null;
};
