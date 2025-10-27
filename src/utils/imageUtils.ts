/**
 * Extracts the image URL from an item
 * The API resolver populates the imageUrl field with the appropriate image
 *
 * @param item - Item object with imageUrl field
 * @returns Image URL or null if no image is available
 */
export const getItemImageUrl = (item: any): string | null => {
  return item?.imageUrl || null;
};
