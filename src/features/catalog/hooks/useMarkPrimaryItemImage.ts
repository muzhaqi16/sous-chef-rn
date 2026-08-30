import { useTranslation } from '#/i18n';
import { useMutation } from '@apollo/client/react';
import { MarkPrimaryItemImageDocument } from '#features/catalog/hooks/useMarkPrimaryItemImage.generated';
import { alertMutationFailure } from '#features/catalog/hooks/alertMutationFailure';
import { errorService } from '#/services/errorService';

/**
 * Promotes one of an item's photos to its hero. No `update` and no optimistic
 * response: the mutation returns the fully reordered gallery, and reproducing
 * the server's ordering optimistically is the duplication worth avoiding.
 */
export function useMarkPrimaryItemImage() {
  const { t } = useTranslation();
  const [markPrimaryItemImage, { loading }] = useMutation(
    MarkPrimaryItemImageDocument,
  );

  /** Returns whether the photo is now the hero. Alerts on every failure. */
  const markPrimary = async (imageId: string): Promise<boolean> => {
    let result;
    try {
      result = await markPrimaryItemImage({
        variables: { input: { imageId } },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Error marking primary item image:',
      });
    }

    // A throw escaped Apollo's errorPolicy entirely — nothing to interpret.
    if (!result) {
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
