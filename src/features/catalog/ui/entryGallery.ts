import { EntryImageSource } from '#/graphql/generated/schemaTypes';
import { galleryPhotos } from '#utils/imageUtils';

/** A household entry's photo, as its detail fragment selects it. */
export interface EntryImageRead {
  url: string;
  source: EntryImageSource;
  catalogImageId?: string | null;
}

/**
 * The hero's pages for a household entry, the household's choice first: its
 * own upload leads as a page of its own, and an item photo it picked moves to
 * the front of the item's photos.
 */
export function entryGallery<P extends { id: string }>(
  image: EntryImageRead | null | undefined,
  photos: readonly P[] | null | undefined,
): { leadImageUrl: string | null; photos: P[] } {
  const all = photos ?? [];
  if (image?.source !== EntryImageSource.Household) {
    return { leadImageUrl: null, photos: galleryPhotos(all) };
  }
  const chosen = image.catalogImageId
    ? all.find(photo => photo.id === image.catalogImageId)
    : undefined;
  // An upload, or a picked photo this read does not list: shown by its url.
  if (!chosen) return { leadImageUrl: image.url, photos: galleryPhotos(all) };
  return {
    leadImageUrl: null,
    photos: galleryPhotos([chosen, ...all.filter(photo => photo !== chosen)]),
  };
}
