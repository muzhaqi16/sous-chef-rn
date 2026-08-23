import { ImagePerspective } from '#/graphql/generated/schemaTypes';
import { logger } from '#/utils/environment';

// =============================================================================
// IMAGE SIZE SELECTION
// =============================================================================

export type PreferredSize =
  | 'xlarge'
  | 'large'
  | 'medium'
  | 'small'
  | 'thumbnail';

type ImageVariant = { url: string; kind?: string | null };

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
 * This is the LIST/CARD path — it reads `Item.images`, which returns at most
 * one row (the primary photo's best asset). Screens showing a gallery read
 * `Item.photos` instead; see `photoDisplayUrl`.
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

  // 4. Try nested .item via getItemImageUrl
  if (source.item) {
    const fromItem = getItemImageUrl(source.item, preferredSize);
    if (fromItem) return fromItem;
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
      logger.warn(
        '[getItemImageUrl] Invalid imageUrl (not a full URL):',
        imageUrl,
      );
      return null;
    }
    return imageUrl;
  }

  return null;
};

// =============================================================================
// GALLERY (Item.photos)
// =============================================================================

/**
 * How many photos the detail carousel renders.
 *
 * Not a product limit — `MultiImagePicker` already caps user uploads at 6. This
 * bounds PUBLIC catalog items, which aggregate provider images and can carry
 * many more. Sized to hold the whole perspective set (7) plus one, because
 * `galleryPhotos` reserves a slot per perspective before filling the rest.
 */
export const MAX_GALLERY_PHOTOS = 8;

/** The `Item.photos` shape these helpers need. Structural so the generated
 *  fragment type satisfies it without a cast. */
export interface PhotoLike {
  url: string;
  perspective?: string | null;
  variants?: readonly ImageVariant[] | null;
}

/**
 * Best URL to render for one photo at a given size.
 *
 * `variants` is empty until the processing job has run, so the original `url`
 * is the documented fallback — never return null here, a photo always has an
 * asset to show.
 */
export function photoDisplayUrl(
  photo: PhotoLike,
  preferredSize: PreferredSize = 'large',
): string {
  const kind = PREFERRED_SIZE_TO_KIND[preferredSize];
  if (kind && photo.variants) {
    const variant = photo.variants.find(v => v.kind === kind);
    if (variant) return variant.url;
  }
  return photo.url;
}

/**
 * A photo's perspective when the caller handed us materialized data. Structural
 * rather than a generic constraint: constraining `T` makes TypeScript infer the
 * constraint itself for a possibly-undefined argument, which erased the element
 * type at every call site. Masked refs carry no fields and read as null here,
 * which degrades this to a plain in-order slice.
 */
function readPerspective(photo: unknown): string | null {
  if (
    typeof photo !== 'object' ||
    photo === null ||
    !('perspective' in photo)
  ) {
    return null;
  }
  const value = photo.perspective;
  return typeof value === 'string' ? value : null;
}

/**
 * The photos to render, capped at `MAX_GALLERY_PHOTOS`.
 *
 * A plain `slice(0, N)` is wrong here. `Item.photos` orders primary, then
 * *featured* photos — any perspective, unbounded — and only then the
 * front/back/left/right/top/nutrition_label/ingredient_list run. A catalog item
 * carrying several featured provider shots therefore pushes `nutrition_label`
 * and `ingredient_list` past the cap, dropping exactly the angles the fullscreen
 * viewer exists to show. So: reserve a slot for the first photo of each distinct
 * perspective, then fill what's left in order.
 *
 * Selection changes which photos survive, never their order — the returned array
 * is always in the server's sequence, which the gallery's paging depends on.
 */
export function galleryPhotos<T>(photos: readonly T[] | null | undefined): T[] {
  if (!photos || photos.length === 0) return [];
  if (photos.length <= MAX_GALLERY_PHOTOS) return [...photos];

  const keep = new Set<number>();
  const seenPerspectives = new Set<string>();
  photos.forEach((photo, index) => {
    const perspective = readPerspective(photo);
    if (!perspective || seenPerspectives.has(perspective)) return;
    seenPerspectives.add(perspective);
    if (keep.size < MAX_GALLERY_PHOTOS) keep.add(index);
  });
  for (let i = 0; i < photos.length && keep.size < MAX_GALLERY_PHOTOS; i += 1) {
    keep.add(i);
  }

  return [...keep].sort((a, b) => a - b).map(index => photos[index]);
}

// =============================================================================
// PERSPECTIVE
// =============================================================================

/**
 * Perspectives the capture flow offers, in gallery order. Matches the server's
 * ordering so the slot a user picks is the position the photo lands in.
 */
export const CAPTURE_PERSPECTIVES: string[] = [
  'front',
  'back',
  'left',
  'right',
  'top',
  'nutrition_label',
  'ingredient_list',
];

const PERSPECTIVE_TO_ENUM: Record<string, ImagePerspective> = {
  front: ImagePerspective.Front,
  back: ImagePerspective.Back,
  left: ImagePerspective.Left,
  right: ImagePerspective.Right,
  top: ImagePerspective.Top,
  nutrition_label: ImagePerspective.NutritionLabel,
  ingredient_list: ImagePerspective.IngredientList,
};

/**
 * Map the lower-cased perspective the picker works in to the `ImagePerspective`
 * enum `confirmItemImageUpload` takes. Unknown values return undefined so the
 * upload still goes through untagged rather than failing validation.
 */
export function toImagePerspective(
  perspective: string | null | undefined,
): ImagePerspective | undefined {
  if (!perspective) return undefined;
  return PERSPECTIVE_TO_ENUM[perspective.toLowerCase()];
}

/**
 * Localized display label for a perspective.
 *
 * Takes `t` rather than returning English: these labels are rendered as visible
 * caption text in the photo viewer and spliced into accessibility copy, so a
 * hardcoded table put "Nutrition" inside otherwise-Spanish UI. An unrecognised
 * perspective (a provider value outside our set) falls back to its capitalized
 * raw form, which is still better than a missing-key marker.
 */
export function getPerspectiveLabel(
  perspective: string,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  return t(`itemPhotos.perspective.${perspective}`, {
    defaultValue: perspective.charAt(0).toUpperCase() + perspective.slice(1),
  });
}
