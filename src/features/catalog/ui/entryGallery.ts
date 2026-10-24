import {
  EntryImageSource,
  type EntryImage,
} from '#/graphql/generated/schemaTypes';
import { galleryPhotos, MAX_GALLERY_PHOTOS } from '#utils/imageUtils';

/** A household entry's photo, as its detail fragment selects it. */
export type EntryImageRead = Pick<EntryImage, 'url' | 'source'> &
  Partial<Pick<EntryImage, 'catalogImageId'>>;

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
  // The cap prefers one photo per perspective, which could drop the pick.
  const rest = galleryPhotos(all.filter(photo => photo !== chosen));
  return {
    leadImageUrl: null,
    photos: [chosen, ...rest.slice(0, MAX_GALLERY_PHOTOS - 1)],
  };
}
