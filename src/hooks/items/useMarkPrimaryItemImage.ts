import { useTranslation } from 'react-i18next';
import { useMutation } from '@apollo/client/react';
import { MarkPrimaryItemImageDocument } from './useMarkPrimaryItemImage.generated';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import { alertMutationFailure } from './alertMutationFailure';

/**
 * Promotes one of an item's photos to its hero.
 *
 * No `update` callback and no optimistic response: the mutation returns the
 * item with its full reordered gallery, so Apollo's normalization writes the
 * new `isPrimary` flags and `imageUrl` through on its own. An optimistic layer
 * would have to reproduce the server's gallery ordering — primary, then
 * featured, then by perspective — to avoid a visible reshuffle when the real
 * response lands, which is exactly the server logic worth not duplicating.
 */
export function useMarkPrimaryItemImage() {
  const { t } = useTranslation();
  const [markPrimaryItemImage, { loading }] = useMutation(
    MarkPrimaryItemImageDocument,
  );

  /** Returns whether the photo is now the hero. Alerts on every failure. */
  const markPrimary = async (imageId: string): Promise<boolean> => {
    const result = await executeMutation(
      () => markPrimaryItemImage({ variables: { input: { imageId } } }),
      'Error marking primary item image:',
    );

    // A throw escaped Apollo's errorPolicy entirely — nothing to interpret.
    if (result === false) {
      alertMutationFailure(t, { keyPrefix: 'itemPhotos.setPrimary' });
      return false;
    }

    const payload = result.data?.markPrimaryItemImage;
    if (payload?.__typename === 'MarkPrimaryItemImagePayload') return true;

    // ForbiddenError here means the cached `canEdit` was stale (the item was
    // published, or ownership moved) — the affordance should not have been
    // offered, so report it rather than silently no-op.
    alertMutationFailure(t, {
      keyPrefix: 'itemPhotos.setPrimary',
      result,
      payload,
    });
    return false;
  };

  return { markPrimary, loading };
}
