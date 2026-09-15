import { useTranslation } from '#/i18n';
import { useMutation } from '@apollo/client/react';
import { MarkItemForReviewDocument } from '#operations/item/item.generated';
import { alertService } from '#/services/alertService';
import { settleMutation } from '#/apollo/utils/settleMutation';
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

  const reportItem = async (
    itemId: string,
    reason: string,
  ): Promise<boolean> => {
    const settled = await settleMutation(
      () =>
        markForReview({
          variables: { input: { itemId, reason: reason.trim() } },
        }),
      {
        document: MarkItemForReviewDocument,
        fallback: t('reportItem.failedBody'),
        title: t('labels.couldnTSendThat'),
        copy: {
          // Already flagged and waiting on an admin: it landed, so a retry
          // cannot improve on it.
          [ErrorCode.Conflict]: {
            title: t('reportItem.alreadyReportedTitle'),
            body: t('reportItem.alreadyReportedBody'),
          },
          [ErrorCode.NotFound]: {
            title: t('errors.itemNotFound'),
            body: t(
              'labels.thisItemIsnTInTheCatalogAnyMoreItMayHaveBeenRemoved',
            ),
          },
        },
      },
    );

    if (settled.status === 'failed') {
      return settled.failure?.code === ErrorCode.Conflict;
    }
    alertService.alert(t('reportItem.sentTitle'), t('reportItem.sentBody'));
    return true;
  };

  return { reportItem, loading };
}
