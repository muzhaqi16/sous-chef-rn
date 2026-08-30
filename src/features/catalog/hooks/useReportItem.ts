import { useTranslation } from '#/i18n';
import { useMutation } from '@apollo/client/react';
import { MarkItemForReviewDocument } from '#operations/item/item.generated';
import { alertService } from '#/services/alertService';
import { alertMutationFailure } from '#features/catalog/hooks/alertMutationFailure';
import { errorService } from '#/services/errorService';

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
    let result;
    try {
      result = await markForReview({
        variables: { input: { itemId, reason: reason.trim() } },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Error reporting item:',
      });
    }

    // A throw escaped Apollo's errorPolicy entirely — nothing to interpret.
    if (!result) {
      alertMutationFailure(t, { keyPrefix: 'reportItem' });
      return false;
    }

    const payload = result.data?.markItemForReview;
    if (payload?.__typename === 'MarkItemForReviewPayload') {
      alertService.alert(t('reportItem.sentTitle'), t('reportItem.sentBody'));
      return true;
    }

    // The item is already flagged and waiting on an admin. Nothing went wrong
    // and a retry can't improve on it, so this counts as sent — reporting it as
    // a failure would invite the user to keep re-sending something that landed.
    if (payload?.__typename === 'ConflictError') {
      alertService.alert(
        t('reportItem.alreadyReportedTitle'),
        t('reportItem.alreadyReportedBody'),
      );
      return true;
    }

    alertMutationFailure(t, { keyPrefix: 'reportItem', result, payload });
    return false;
  };

  return { reportItem, loading };
}
