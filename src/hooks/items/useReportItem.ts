import { useTranslation } from 'react-i18next';
import { useMutation } from '@apollo/client/react';
import { MarkItemForReviewDocument } from '#operations/item/item.generated';
import { alertService } from '#/services/alertService';
import { executeMutation } from '#/utils/compilerSafeWrappers';

/**
 * Flags a catalog item for admin moderation with a free-text reason.
 *
 * This is a REPORT, not an edit proposal. It backs the autocomplete affordance,
 * where the user has only seen a name, brand and thumbnail and so has no basis
 * for filling in a structured diff. The barcode flow, where the user is looking
 * at the item's full details, uses `useSuggestItemEdit` instead.
 */
export function useReportItem() {
  const { t } = useTranslation();
  const [markForReview, { loading }] = useMutation(MarkItemForReviewDocument);

  const reportItem = async (
    itemId: string,
    reason: string,
  ): Promise<boolean> => {
    const result = await executeMutation(
      () =>
        markForReview({
          variables: { input: { itemId, reason: reason.trim() } },
        }),
      'Error reporting item:',
    );

    const succeeded =
      result !== false &&
      result.data?.markItemForReview?.__typename === 'MarkItemForReviewPayload';

    if (succeeded) {
      alertService.alert(t('reportItem.sentTitle'), t('reportItem.sentBody'));
    } else {
      alertService.alert(
        t('reportItem.failedTitle'),
        t('reportItem.failedBody'),
      );
    }
    return succeeded;
  };

  return { reportItem, loading };
}
