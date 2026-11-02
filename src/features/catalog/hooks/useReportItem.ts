import { useTranslation } from '#/i18n';
import { useMutation } from '@apollo/client/react';
import { MarkItemForReviewDocument } from '#operations/item/item.generated';
import { toastService } from '#/services/toastService';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { presentFailure } from '#/utils/errors/presentFailure';
import { ErrorCode } from '#/graphql/generated/schemaTypes';

/**
 * Flags a catalog item for admin moderation with a free-text reason — a REPORT,
 * not an edit proposal. Backs the autocomplete affordance, where the user has
 * seen only a name, brand and thumbnail; the barcode flow uses
 * `useSuggestItemEdit` instead.
 */
export function useReportItem() {
  const { t } = useTranslation();
  const [markForReview, { loading }] = useMutation(MarkItemForReviewDocument);

  /** `imageId`: the approved photo the report is about, when it is one. */
  const reportItem = async (
    itemId: string,
    reason: string,
    imageId?: string,
  ): Promise<boolean> => {
    const settled = await settleMutation(
      () =>
        markForReview({
          variables: { input: { itemId, reason: reason.trim(), imageId } },
        }),
      {
        document: MarkItemForReviewDocument,
        fallback: t('reportItem.failedBody'),
        title: t('labels.couldnTSendThat'),
        copy: {
          [ErrorCode.NotFound]: {
            title: t('errors.itemNotFound'),
            body: t(
              'labels.thisItemIsnTInTheCatalogAnyMoreItMayHaveBeenRemoved',
            ),
          },
        },
        present: 'none',
      },
    );

    // Already reported and waiting on an admin: it landed, so a retry cannot
    // improve on it. A server without `alreadyReported` answers with a Conflict.
    const repeated =
      settled.failure?.code === ErrorCode.Conflict ||
      appliedPayload(settled.data)?.alreadyReported === true;
    if (repeated) {
      toastService.info(t('reportItem.alreadyReportedBody'));
      return true;
    }
    if (settled.status === 'failed') {
      if (settled.failure) presentFailure(settled.failure);
      return false;
    }
    toastService.success(t('reportItem.sentBody'));
    return true;
  };

  return { reportItem, loading };
}
