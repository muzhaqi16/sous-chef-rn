import { useFragment } from '@apollo/client/react';
import type { FragmentType } from '@apollo/client/masking';
import {
  ItemPhotoCarousel_ItemPhotoFragmentDoc,
  type ItemPhotoCarousel_ItemPhotoFragment,
} from '#features/catalog/ui/ItemPhotoCarousel.generated';

/**
 * A photo as a caller can hold it: the masked ref Apollo hands back at runtime,
 * or the materialized object — codegen inlines fragment spreads into the
 * screen-level types, so screens are typed as holding the latter.
 */
export type ItemPhotoRef =
  | FragmentType<typeof ItemPhotoCarousel_ItemPhotoFragmentDoc>
  | ItemPhotoCarousel_ItemPhotoFragment;

/**
 * A photo ref read through its fragment. An incomplete read falls back to the
 * ref's materialized form, or null for a bare masked ref: it carries no `url`,
 * so rendering it would put `undefined` into an <Image>.
 */
export const useItemPhoto = (
  ref: ItemPhotoRef | null,
): ItemPhotoCarousel_ItemPhotoFragment | null => {
  const result = useFragment({
    fragment: ItemPhotoCarousel_ItemPhotoFragmentDoc,
    fragmentName: 'ItemPhotoCarousel_itemPhoto',
    from: ref,
  });
  if (!ref) return null;
  if (result.complete) return result.data;
  return 'url' in ref && typeof ref.url === 'string' ? ref : null;
};
