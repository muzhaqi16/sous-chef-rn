import { useTranslation } from '#/i18n';
import { useMutation } from '@apollo/client/react';
import { MarkPrimaryItemImageDocument } from '#features/catalog/hooks/useMarkPrimaryItemImage.generated';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { ErrorCode } from '#/graphql/generated/schemaTypes';

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

  /**
   * Returns whether the photo is now the hero. A ForbiddenError means the
   * cached `canEdit` was stale, so it is reported rather than silently dropped.
   */
  const markPrimary = async (imageId: string): Promise<boolean> => {
    const settled = await settleMutation(
      () => markPrimaryItemImage({ variables: { input: { imageId } } }),
      {
        document: MarkPrimaryItemImageDocument,
        fallback: t('itemPhotos.setPrimary.failedBody'),
        title: t('labels.couldnTSetThatPhoto'),
        copy: {
          [ErrorCode.NotFound]: {
            title: t('itemPhotos.setPrimary.notFoundTitle'),
            body: t('itemPhotos.setPrimary.notFoundBody'),
          },
        },
      },
    );
    return settled.status !== 'failed';
  };

  return { markPrimary, loading };
}
